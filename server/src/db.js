import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { ADMIN_INITIAL_PASSWORD, DB_PATH } from './config.js';

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

/* =========================================================
   BASE DE DATOS
   ========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cajero',
    active INTEGER NOT NULL DEFAULT 1,
    session_token TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS flavors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS beverages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    price REAL NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS extras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    price REAL NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    total REAL NOT NULL,
    cash REAL NOT NULL,
    qr REAL NOT NULL,
    change_amount REAL NOT NULL,
    items_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    closed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_date TEXT UNIQUE NOT NULL,
    total REAL NOT NULL,
    cash_sales REAL NOT NULL,
    qr_sales REAL NOT NULL,
    cash_expected REAL NOT NULL,
    cash_counted REAL,
    notes TEXT DEFAULT '',
    staff_json TEXT NOT NULL,
    closed_by INTEGER,
    closed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    sales_json TEXT NOT NULL DEFAULT '[]',
    orders_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    emoji TEXT DEFAULT '🎉',
    price REAL NOT NULL,
    components_json TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  /* Opciones de una promoción: "2 Medianas + Coca-Cola = Bs 90" */
  CREATE TABLE IF NOT EXISTS promotion_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promotion_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    promo_price REAL NOT NULL,
    normal_price REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  );

  /* Productos incluidos en cada opción.
     type = 'product'  → product_id + size_name (pizza del menú)
     type = 'beverage' → beverage_id (NULL = el cliente elige)
     type = 'other'    → producto libre con name + unit_price */
  CREATE TABLE IF NOT EXISTS promotion_option_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    option_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    product_id INTEGER,
    size_name TEXT,
    beverage_id INTEGER,
    name TEXT DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0
  );

  /* Configuración general (QR de pago, etc.) */
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  /* Contador de pedidos por día: KIKIS-000001 se reinicia cada día */
  CREATE TABLE IF NOT EXISTS order_counters (
    day TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0
  );
`);


/* =========================================================
   MIGRACIONES DE COLUMNAS
   SQLite no tiene "ADD COLUMN IF NOT EXISTS", así que se
   revisan las columnas existentes antes de agregarlas.
   ========================================================= */

function addColumn(table, column, definition) {
  const exists = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some(c => c.name === column);

  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Promociones: imagen y vigencia
addColumn('promotions', 'image', "TEXT DEFAULT ''");
addColumn('promotions', 'start_date', 'TEXT');
addColumn('promotions', 'end_date', 'TEXT');

// Ventas: código visible por día y método de pago
addColumn('orders', 'order_code', 'TEXT');
addColumn('orders', 'order_date', 'TEXT');
addColumn('orders', 'daily_seq', 'INTEGER');
addColumn('orders', 'payment_method', 'TEXT');

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_daily_seq
    ON orders(order_date, daily_seq);

  CREATE INDEX IF NOT EXISTS idx_promotion_options_promo
    ON promotion_options(promotion_id);

  CREATE INDEX IF NOT EXISTS idx_promotion_items_option
    ON promotion_option_items(option_id);
`);

// Ventas antiguas: completar fecha y método de pago
// (created_at se guarda en hora local)
db.exec(`
  UPDATE orders
  SET order_date = date(created_at)
  WHERE order_date IS NULL;

  UPDATE orders
  SET payment_method = CASE
    WHEN cash > 0 AND qr > 0 THEN 'mixed'
    WHEN qr > 0 THEN 'qr'
    ELSE 'cash'
  END
  WHERE payment_method IS NULL;
`);

// Valor inicial: el pago por QR queda activado como antes
db.prepare(`
  INSERT OR IGNORE INTO settings(key, value) VALUES ('qr_enabled', '1')
`).run();


/* =========================================================
   PROMOCIONES ANTIGUAS → OPCIONES
   Antes cada promoción tenía un único precio y una lista de
   componentes. Se convierten en una promoción con una sola
   opción para no perder nada.
   ========================================================= */

const migrateLegacyPromotions = db.transaction(() => {
  const legacy = db.prepare(`
    SELECT p.*
    FROM promotions p
    WHERE NOT EXISTS (
      SELECT 1 FROM promotion_options o WHERE o.promotion_id = p.id
    )
  `).all();

  if (!legacy.length) return;

  const individual = db.prepare(`
    SELECT id FROM products WHERE kind = 'individual' ORDER BY id LIMIT 1
  `).get();

  const sizePrice = db.prepare(`
    SELECT price FROM product_sizes WHERE product_id = ? AND name = ?
  `);

  const cheapestDrink = db.prepare(`
    SELECT MIN(price) AS price FROM beverages WHERE active = 1
  `).get()?.price || 0;

  const insertOption = db.prepare(`
    INSERT INTO promotion_options(promotion_id, name, promo_price, normal_price, active, sort)
    VALUES (?, ?, ?, ?, 1, 0)
  `);

  const insertItem = db.prepare(`
    INSERT INTO promotion_option_items(option_id, type, product_id, size_name, beverage_id, name, quantity, unit_price, sort)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)
  `);

  for (const promo of legacy) {
    let components = [];

    try {
      components = JSON.parse(promo.components_json || '[]');
    } catch {
      components = [];
    }

    const items = components.map(c => {
      const qty = Math.max(1, Number(c.qty) || 1);

      if (c.type === 'pizza') {
        const price = individual ? sizePrice.get(individual.id, c.size)?.price || 0 : 0;
        return { type: 'product', productId: individual?.id ?? null, size: c.size, qty, price };
      }

      if (c.type === 'beverage') {
        return { type: 'beverage', qty, price: cheapestDrink };
      }

      return { type: 'other', name: c.name || 'Producto', qty, price: Number(c.price || 0) };
    });

    const normal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    const optionId = Number(
      insertOption.run(promo.id, promo.name, Number(promo.price || 0), normal).lastInsertRowid
    );

    items.forEach((i, index) => {
      insertItem.run(optionId, i.type, i.productId ?? null, i.size ?? null, i.name ?? '', i.qty, i.price, index);
    });
  }
});

migrateLegacyPromotions();

/* =========================================================
   DATOS INICIALES
   ========================================================= */

function seed() {

  /* =======================================================
     ADMINISTRADOR
     ======================================================= */

  if (
    !db
      .prepare('SELECT COUNT(*) AS c FROM users')
      .get().c
  ) {

    db.prepare(`
      INSERT INTO users(
        name,
        username,
        password_hash,
        role
      )
      VALUES (?, ?, ?, ?)
    `).run(
      'Administrador',
      'admin',
      bcrypt.hashSync(ADMIN_INITIAL_PASSWORD, 10),
      'admin'
    );
  }


  /* =======================================================
     PRODUCTOS
     ======================================================= */

  if (
    !db
      .prepare('SELECT COUNT(*) AS c FROM products')
      .get().c
  ) {

    const p = db.prepare(`
      INSERT INTO products(
        name,
        kind,
        price,
        description
      )
      VALUES (?, ?, ?, ?)
    `);

    p.run(
      'Pizza Individual',
      'individual',
      30,
      'Personal, pequeña, mediana, grande, familiar, súper jumbo e interminable'
    );

    p.run(
      'Promo 2 Pizzas',
      'double',
      70,
      'Dos pizzas del mismo tamaño: pequeña o mediana'
    );

    p.run(
      'Pizza + Gaseosa',
      'combo',
      50,
      'Una pizza de un sabor + gaseosa'
    );
  }


  /* =======================================================
     SABORES
     ======================================================= */

  if (
    !db
      .prepare('SELECT COUNT(*) AS c FROM flavors')
      .get().c
  ) {

    const f = db.prepare(`
      INSERT INTO flavors(name)
      VALUES (?)
    `);

    [
      'Pepperoni',
      'Hawaiana',
      'Margarita',
      'Americana',
      'Cuatro Quesos',
      'Carnívora'
    ].forEach(name => {
      f.run(name);
    });
  }


  /* =======================================================
     REFRESCOS
     ======================================================= */

  if (
    !db
      .prepare('SELECT COUNT(*) AS c FROM beverages')
      .get().c
  ) {

    const b = db.prepare(`
      INSERT INTO beverages(
        name,
        price
      )
      VALUES (?, ?)
    `);

    [
      ['Coca-Cola 500 ml', 10],
      ['Fanta 500 ml', 10],
      ['Sprite 500 ml', 10]
    ].forEach(([name, price]) => {
      b.run(name, price);
    });
  }


  /* =======================================================
     INGREDIENTES EXTRAS
     ======================================================= */

  if (
    !db
      .prepare('SELECT COUNT(*) AS c FROM extras')
      .get().c
  ) {

    const e = db.prepare(`
      INSERT INTO extras(
        name,
        price
      )
      VALUES (?, ?)
    `);

    [
      ['Queso extra', 5],
      ['Pepperoni extra', 7],
      ['Jamón extra', 6],
      ['Tocino extra', 7],
      ['Champiñones', 5],
      ['Aceitunas', 5],
      ['Piña extra', 5]
    ].forEach(([name, price]) => {
      e.run(name, price);
    });
  }


  /* =======================================================
     TAMAÑOS Y PRECIOS DE CADA PRODUCTO
     Antes estaban fijos en el código del cliente; ahora se
     guardan aquí para que el administrador los edite.
     ======================================================= */

  const withoutSizes = db.prepare(`
    SELECT p.id, p.kind
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_sizes s WHERE s.product_id = p.id
    )
  `).all();

  const insertSize = db.prepare(`
    INSERT INTO product_sizes(product_id, name, price, sort)
    VALUES (?, ?, ?, ?)
  `);

  for (const product of withoutSizes) {
    defaultSizes(product.kind).forEach(([name, price], index) => {
      insertSize.run(product.id, name, price, index);
    });
  }
}

export function defaultSizes(kind) {
  if (kind === 'individual') {
    return [
      ['Personal', 19],
      ['Pequeña', 33],
      ['Mediana', 49],
      ['Grande', 59],
      ['Familiar', 79],
      ['Super', 89],
      ['Jumbo', 139],
      ['Interminable', 169]
    ];
  }

  if (kind === 'double') {
    return [
      ['Pequeña', 60],
      ['Mediana', 89],
      ['Grande', 109],
      ['Familiares', 149]
    ];
  }

  return [
    ['Personal', 50],
    ['Pequeña', 55],
    ['Mediana', 65],
    ['Grande', 75],
    ['Familiar', 90]
  ];
}

/* =========================================================
   EJECUTAR DATOS INICIALES
   ========================================================= */

seed();

console.log('Base de datos Pizzeria POS cargada correctamente');