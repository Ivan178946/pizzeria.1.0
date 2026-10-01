/* =========================================================
   SERVICIO DE PRODUCTOS Y PRECIOS POR TAMAÑO
========================================================= */

import { db } from '../db.js';

export const PRODUCT_KINDS = ['individual', 'double', 'combo'];

const MAX_SIZES = 15;


/* =========================================================
   LEER
========================================================= */

export function sizesFor(productId) {
  return db.prepare(`
    SELECT id, name, price
    FROM product_sizes
    WHERE product_id = ?
    ORDER BY sort, id
  `).all(productId);
}

export function withSizes(product) {
  return product
    ? { ...product, sizes: sizesFor(product.id) }
    : null;
}

export function findProduct(id) {
  return withSizes(
    db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  );
}

// Tamaños que se pueden usar en una promoción: los de las
// pizzas individuales.
export function individualSizeNames() {
  return db.prepare(`
    SELECT DISTINCT s.name
    FROM product_sizes s
    JOIN products p ON p.id = s.product_id
    WHERE p.kind = 'individual'
  `).all().map(r => r.name);
}


/* =========================================================
   VALIDAR DATOS DEL ADMINISTRADOR
========================================================= */

export function parseProductInput(body = {}, { requireKind = false } = {}) {
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();

  if (!name) {
    throw new Error('El producto necesita un nombre');
  }

  if (name.length > 50) {
    throw new Error('El nombre es demasiado largo (máximo 50 caracteres)');
  }

  let kind;

  if (requireKind) {
    kind = String(body.kind || '');

    if (!PRODUCT_KINDS.includes(kind)) {
      throw new Error('Elige qué tipo de producto es');
    }
  }

  if (!Array.isArray(body.sizes) || body.sizes.length === 0) {
    throw new Error('Agrega al menos un tamaño con su precio');
  }

  if (body.sizes.length > MAX_SIZES) {
    throw new Error(`Máximo ${MAX_SIZES} tamaños por producto`);
  }

  const seen = new Set();

  const sizes = body.sizes.map((size, index) => {
    const sizeName = String(size?.name || '').trim();
    const price = Number(size?.price);

    if (!sizeName) {
      throw new Error(`Escribe el nombre del tamaño ${index + 1}`);
    }

    const key = sizeName.toLowerCase();

    if (seen.has(key)) {
      throw new Error(`El tamaño "${sizeName}" está repetido`);
    }

    seen.add(key);

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Precio inválido en el tamaño "${sizeName}"`);
    }

    return {
      name: sizeName.slice(0, 30),
      price: Number(price.toFixed(2))
    };
  });

  return { name, description, kind, sizes };
}


/* =========================================================
   GUARDAR TAMAÑOS (reemplaza la lista completa)
   Las ventas anteriores guardan su propia copia del precio,
   así que cambiar precios no altera el historial.
========================================================= */

export const replaceSizes = db.transaction((productId, sizes) => {
  db.prepare('DELETE FROM product_sizes WHERE product_id = ?').run(productId);

  const insert = db.prepare(`
    INSERT INTO product_sizes(product_id, name, price, sort)
    VALUES (?, ?, ?, ?)
  `);

  sizes.forEach((size, index) => {
    insert.run(productId, size.name, size.price, index);
  });

  // El precio "desde" del producto es el tamaño más barato.
  db.prepare('UPDATE products SET price = ? WHERE id = ?').run(
    Math.min(...sizes.map(s => s.price)),
    productId
  );
});
