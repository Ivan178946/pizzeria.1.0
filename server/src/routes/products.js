import express from 'express';

import { db, defaultSizes } from '../db.js';
import { auth, admin } from '../middleware/auth.js';
import { log } from '../utils/audit.js';
import {
  findProduct,
  parseProductInput,
  replaceSizes,
  withSizes
} from '../services/productService.js';

const router = express.Router();

function describeSizes(sizes) {
  return sizes.map(s => `${s.name} Bs ${s.price}`).join(', ');
}


// =========================================================
// LISTAR PRODUCTOS CON SUS PRECIOS (incluye ocultos)
// =========================================================

router.get('/', auth, admin, (req, res) => {
  const products = db
    .prepare('SELECT * FROM products ORDER BY id')
    .all()
    .map(withSizes);

  res.json(products);
});


// =========================================================
// CREAR PRODUCTO NUEVO
// Si no se envían tamaños se usan los del tipo elegido.
// =========================================================

router.post('/', auth, admin, (req, res) => {
  try {
    const body = { ...req.body };

    if (!Array.isArray(body.sizes) || !body.sizes.length) {
      body.sizes = defaultSizes(body.kind).map(([name, price]) => ({ name, price }));
    }

    const data = parseProductInput(body, { requireKind: true });

    const result = db.prepare(`
      INSERT INTO products(name, kind, price, description)
      VALUES (?, ?, ?, ?)
    `).run(
      data.name,
      data.kind,
      Math.min(...data.sizes.map(s => s.price)),
      data.description
    );

    const id = Number(result.lastInsertRowid);

    replaceSizes(id, data.sizes);

    log(req.user.id, 'CREATE_PRODUCT', `${data.name} (${data.kind}) | ${describeSizes(data.sizes)}`);

    res.status(201).json(findProduct(id));

  } catch (error) {
    res.status(400).json({
      error: error.message || 'No se pudo crear el producto'
    });
  }
});


// =========================================================
// EDITAR NOMBRE, DESCRIPCIÓN Y PRECIOS
// Si solo llega "active", únicamente se oculta o muestra.
// =========================================================

router.patch('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  const current = findProduct(id);

  if (!current) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  try {
    const body = req.body || {};

    if (Object.keys(body).length === 1 && 'active' in body) {
      const active = body.active ? 1 : 0;

      db.prepare('UPDATE products SET active = ? WHERE id = ?').run(active, id);

      log(req.user.id, 'TOGGLE_PRODUCT', `${current.name} ${active ? 'visible' : 'oculto'}`);

      return res.json(findProduct(id));
    }

    const data = parseProductInput(body);

    db.prepare(`
      UPDATE products
      SET name = ?, description = ?
      WHERE id = ?
    `).run(data.name, data.description, id);

    replaceSizes(id, data.sizes);

    log(
      req.user.id,
      'UPDATE_PRICES',
      `${data.name} | antes: ${describeSizes(current.sizes)} | ahora: ${describeSizes(data.sizes)}`
    );

    res.json(findProduct(id));

  } catch (error) {
    res.status(400).json({
      error: error.message || 'No se pudo guardar el producto'
    });
  }
});


// =========================================================
// ELIMINAR PRODUCTO
// =========================================================

router.delete('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  const current = findProduct(id);

  if (!current) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM product_sizes WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  })();

  log(req.user.id, 'DELETE_PRODUCT', current.name);

  res.json({ ok: true });
});

export default router;
