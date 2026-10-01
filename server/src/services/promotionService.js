/* =========================================================
   SERVICIO DE PROMOCIONES
   Una promoción (ej. "Gran Inauguración") tiene varias
   opciones; cada opción es un combo con su propio precio
   promocional y una lista libre de productos:

   Promoción
     └─ Opción "2 Medianas + Coca-Cola"  → Bs 90
          ├─ 2 × Pizza Individual (Mediana)
          └─ 1 × Coca-Cola 500 ml
========================================================= */

import { db } from '../db.js';
import { localDate } from '../utils/date.js';

const MAX_QTY = 20;
const MAX_OPTIONS = 20;
const MAX_ITEMS = 15;
const MAX_IMAGE_LENGTH = 2_000_000; // ~1.5 MB en base64

const money = value => Number(Number(value || 0).toFixed(2));


/* =========================================================
   CATÁLOGO ACTUAL (para precios y nombres)
========================================================= */

const getProduct = id => db.prepare('SELECT * FROM products WHERE id = ?').get(id);

const getSize = (productId, name) => db.prepare(`
  SELECT * FROM product_sizes WHERE product_id = ? AND name = ?
`).get(productId, name);

const getBeverage = id => db.prepare('SELECT * FROM beverages WHERE id = ?').get(id);

function cheapestBeverage() {
  return db.prepare(`
    SELECT MIN(price) AS price FROM beverages WHERE active = 1
  `).get()?.price || 0;
}

// Pizzas físicas que trae una unidad del producto
// (la "Promo 2 Pizzas" del menú trae dos).
export function pizzasPerUnit(kind) {
  return kind === 'double' ? 2 : 1;
}


/* =========================================================
   DESCRIBIR UN PRODUCTO DE LA OPCIÓN
   Devuelve nombre visible y precio unitario vigente.
========================================================= */

function describeItem(row) {
  const qty = Number(row.quantity || 1);

  if (row.type === 'product') {
    const product = getProduct(row.product_id);
    const size = product ? getSize(product.id, row.size_name) : null;

    return {
      id: row.id,
      type: 'product',
      productId: row.product_id,
      size: row.size_name,
      kind: product?.kind || 'individual',
      qty,
      label: product
        ? `${product.name} ${row.size_name}`
        : `${row.name || 'Pizza'} ${row.size_name || ''}`.trim(),
      unitPrice: size ? Number(size.price) : Number(row.unit_price || 0),
      available: Boolean(product && product.active && size)
    };
  }

  if (row.type === 'beverage') {
    const beverage = row.beverage_id ? getBeverage(row.beverage_id) : null;

    return {
      id: row.id,
      type: 'beverage',
      beverageId: row.beverage_id || null,
      qty,
      label: beverage ? beverage.name : 'Refresco a elección',
      unitPrice: beverage ? Number(beverage.price) : cheapestBeverage(),
      available: row.beverage_id ? Boolean(beverage && beverage.active) : true
    };
  }

  return {
    id: row.id,
    type: 'other',
    name: row.name,
    qty,
    label: row.name,
    unitPrice: Number(row.unit_price || 0),
    available: true
  };
}

// "2× Pizza Individual Mediana + 1× Coca-Cola 500 ml"
export function optionSummary(items = []) {
  return items
    .map(i => `${i.qty}× ${i.label}`)
    .join(' + ');
}


/* =========================================================
   LEER PROMOCIÓN COMPLETA
========================================================= */

function loadOptions(promotionId) {
  const options = db.prepare(`
    SELECT * FROM promotion_options
    WHERE promotion_id = ?
    ORDER BY sort, id
  `).all(promotionId);

  const itemsOf = db.prepare(`
    SELECT * FROM promotion_option_items
    WHERE option_id = ?
    ORDER BY sort, id
  `);

  return options.map(option => {
    const items = itemsOf.all(option.id).map(describeItem);
    // El precio normal se recalcula con los precios vigentes
    const normalPrice = money(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0));
    const promoPrice = money(option.promo_price);

    return {
      id: option.id,
      promotionId: option.promotion_id,
      name: option.name,
      promoPrice,
      normalPrice,
      savings: money(Math.max(0, normalPrice - promoPrice)),
      active: option.active,
      order: option.sort,
      summary: optionSummary(items),
      available: items.every(i => i.available),
      items
    };
  });
}

export function toPromotion(row) {
  if (!row) return null;

  return {
    id: row.id,
    title: row.name,
    name: row.name,
    description: row.description || '',
    emoji: row.emoji || '🎉',
    image: row.image || '',
    active: row.active,
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    created_at: row.created_at,
    options: loadOptions(row.id)
  };
}

export function findPromotion(id) {
  return toPromotion(
    db.prepare('SELECT * FROM promotions WHERE id = ?').get(id)
  );
}

// ¿La promoción está vigente hoy?
export function isPromotionLive(promotion, day = localDate()) {
  if (!promotion || !promotion.active) return false;
  if (promotion.startDate && day < promotion.startDate) return false;
  if (promotion.endDate && day > promotion.endDate) return false;
  return true;
}

// Para el punto de venta: solo lo vigente y disponible
export function livePromotions() {
  const day = localDate();

  return db
    .prepare('SELECT * FROM promotions WHERE active = 1 ORDER BY id DESC')
    .all()
    .map(toPromotion)
    .filter(p => isPromotionLive(p, day))
    .map(p => ({
      ...p,
      options: p.options.filter(o => o.active && o.available && o.items.length)
    }))
    .filter(p => p.options.length);
}


/* =========================================================
   VALIDAR DATOS ENVIADOS POR EL ADMINISTRADOR
========================================================= */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value, label) {
  const text = String(value || '').trim();

  if (!text) return null;

  if (!DATE_RE.test(text)) {
    throw new Error(`La fecha de ${label} no es válida`);
  }

  return text;
}

function parseItem(item, optionLabel, index) {
  const type = String(item?.type || '');
  const qty = Math.floor(Number(item?.qty ?? item?.quantity));
  const where = `${optionLabel}, producto ${index + 1}`;

  if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) {
    throw new Error(`Cantidad inválida en ${where} (1 a ${MAX_QTY})`);
  }

  if (type === 'product') {
    const productId = Number(item.productId);
    const sizeName = String(item.size || '').trim();
    const product = getProduct(productId);

    if (!product) {
      throw new Error(`Elige un producto válido en ${where}`);
    }

    const size = getSize(productId, sizeName);

    if (!size) {
      throw new Error(`El tamaño "${sizeName}" no existe para ${product.name} (${where})`);
    }

    return { type, productId, size: sizeName, name: product.name, qty, unitPrice: Number(size.price) };
  }

  if (type === 'beverage') {
    const beverageId = item.beverageId ? Number(item.beverageId) : null;

    if (beverageId) {
      const beverage = getBeverage(beverageId);

      if (!beverage) {
        throw new Error(`El refresco elegido ya no existe (${where})`);
      }

      return { type, beverageId, name: beverage.name, qty, unitPrice: Number(beverage.price) };
    }

    return { type, beverageId: null, name: '', qty, unitPrice: cheapestBeverage() };
  }

  if (type === 'other') {
    const name = String(item.name || '').trim().slice(0, 40);
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0);

    if (!name) {
      throw new Error(`Escribe el nombre del producto en ${where}`);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Precio de referencia inválido en ${where}`);
    }

    return { type, name, qty, unitPrice: money(unitPrice) };
  }

  throw new Error(`Tipo de producto inválido en ${where}`);
}

export function parsePromotionInput(body = {}) {
  // El título es el campo principal; se acepta también "name"
  // o "promotionName" por compatibilidad.
  const title = String(body.title || body.name || body.promotionName || '').trim();
  const description = String(body.description || '').trim().slice(0, 200);
  const emoji = String(body.emoji || '🎉').trim().slice(0, 8) || '🎉';
  const image = String(body.image || '');
  const startDate = parseDate(body.startDate, 'inicio');
  const endDate = parseDate(body.endDate, 'finalización');

  if (!title) {
    throw new Error('La promoción necesita un título');
  }

  if (title.length > 100) {
    throw new Error('El título es demasiado largo (máximo 100 caracteres)');
  }

  if (image && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image)) {
    throw new Error('La imagen debe ser PNG, JPG, WEBP o GIF');
  }

  if (image.length > MAX_IMAGE_LENGTH) {
    throw new Error('La imagen es demasiado pesada (máximo 1.5 MB)');
  }

  if (startDate && endDate && endDate < startDate) {
    throw new Error('La fecha de finalización no puede ser anterior a la de inicio');
  }

  if (!Array.isArray(body.options) || body.options.length === 0) {
    throw new Error('Agrega al menos una opción a la promoción');
  }

  if (body.options.length > MAX_OPTIONS) {
    throw new Error(`Máximo ${MAX_OPTIONS} opciones por promoción`);
  }

  const options = body.options.map((option, index) => {
    const label = `la opción ${index + 1}`;
    const promoPrice = Number(option?.promoPrice ?? option?.price);

    if (!Number.isFinite(promoPrice) || promoPrice <= 0) {
      throw new Error(`Ingresa un precio promocional válido en ${label}`);
    }

    if (!Array.isArray(option.items) || option.items.length === 0) {
      throw new Error(`Agrega al menos un producto a ${label}`);
    }

    if (option.items.length > MAX_ITEMS) {
      throw new Error(`Máximo ${MAX_ITEMS} productos en ${label}`);
    }

    const items = option.items.map((item, i) => parseItem(item, label, i));
    const normalPrice = money(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0));

    // Si no se escribe nombre se usa un resumen: "2× Mediana + 1× Coca-Cola 500 ml"
    const name = String(option.name || '').trim().slice(0, 60) ||
      items.map(i => `${i.qty}× ${i.type === 'product' ? i.size : i.name || 'Refresco'}`).join(' + ');

    return {
      id: option.id ? Number(option.id) : null,
      name,
      promoPrice: money(promoPrice),
      normalPrice,
      active: option.active === false || option.active === 0 ? 0 : 1,
      items
    };
  });

  return {
    title,
    description,
    emoji,
    image,
    active: body.active === false || body.active === 0 ? 0 : 1,
    startDate,
    endDate,
    options
  };
}


/* =========================================================
   GUARDAR OPCIONES (reemplaza la lista completa)
   Las ventas guardan su propia copia del detalle, así que
   editar o borrar opciones no altera el historial.
   Llamar dentro de una transacción.
========================================================= */

export function replaceOptions(promotionId, options) {
  const oldOptions = db.prepare(`
    SELECT id FROM promotion_options WHERE promotion_id = ?
  `).all(promotionId);

  const deleteItems = db.prepare('DELETE FROM promotion_option_items WHERE option_id = ?');

  oldOptions.forEach(o => deleteItems.run(o.id));

  db.prepare('DELETE FROM promotion_options WHERE promotion_id = ?').run(promotionId);

  const insertOption = db.prepare(`
    INSERT INTO promotion_options(id, promotion_id, name, promo_price, normal_price, active, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO promotion_option_items(option_id, type, product_id, size_name, beverage_id, name, quantity, unit_price, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const oldIds = new Set(oldOptions.map(o => o.id));

  options.forEach((option, index) => {
    // Se conserva el id de las opciones existentes para que
    // una comanda ya armada siga siendo válida.
    const keepId = option.id && oldIds.has(option.id) ? option.id : null;

    const optionId = Number(
      insertOption.run(
        keepId,
        promotionId,
        option.name,
        option.promoPrice,
        option.normalPrice,
        option.active,
        index
      ).lastInsertRowid
    );

    option.items.forEach((item, i) => {
      insertItem.run(
        optionId,
        item.type,
        item.productId ?? null,
        item.size ?? null,
        item.beverageId ?? null,
        item.name ?? '',
        item.qty,
        item.unitPrice,
        i
      );
    });
  });
}

export function deleteOptions(promotionId) {
  replaceOptions(promotionId, []);
}


/* =========================================================
   VALIDAR UN ITEM DE PROMOCIÓN EN UNA VENTA
   El precio siempre se toma de la base de datos: el cajero
   no puede cobrar una promoción a otro precio.
========================================================= */

export function validatePromoItem(item) {
  const promotion = findPromotion(Number(item.promoId));
  const label = item.name || 'La promoción';

  if (!isPromotionLive(promotion)) {
    throw new Error(`"${label}" ya no está disponible`);
  }

  const option = promotion.options.find(o => o.id === Number(item.optionId));

  if (!option || !option.active || !option.available) {
    throw new Error(`"${label}" ya no está disponible. Quítala y vuelve a agregarla.`);
  }

  if (Math.abs(Number(item.price) - option.promoPrice) > 0.001) {
    throw new Error(`El precio de "${label}" cambió. Quítala y vuelve a agregarla.`);
  }

  const expectedPizzas = option.items
    .filter(i => i.type === 'product')
    .reduce((sum, i) => sum + i.qty * pizzasPerUnit(i.kind), 0);

  const expectedBeverages = option.items
    .filter(i => i.type === 'beverage')
    .reduce((sum, i) => sum + i.qty, 0);

  const pizzas = Array.isArray(item.pizzas) ? item.pizzas : [];
  const beverages = Array.isArray(item.beverages) ? item.beverages : [];

  if (pizzas.length !== expectedPizzas || pizzas.some(p => !p?.flavor)) {
    throw new Error(`Elige el sabor de cada pizza de "${label}"`);
  }

  if (beverages.length !== expectedBeverages || beverages.some(b => !b)) {
    throw new Error(`Elige cada refresco de "${label}"`);
  }

  return option;
}
