import express from 'express';

import { db } from '../db.js';
import { auth, admin } from '../middleware/auth.js';
import { log } from '../utils/audit.js';

const router = express.Router();


// =========================================================
// CATÁLOGO EDITABLE: SABORES, REFRESCOS Y EXTRAS
// Los nombres de tabla vienen de esta lista fija, nunca
// directamente de la URL.
// =========================================================

const TYPES = {
  flavors: { table: 'flavors', label: 'sabor', hasPrice: false },
  beverages: { table: 'beverages', label: 'refresco', hasPrice: true },
  extras: { table: 'extras', label: 'extra', hasPrice: true }
};

function getType(req, res) {
  const type = TYPES[req.params.type];

  if (!type) {
    res.status(404).json({ error: 'Catálogo no encontrado' });
    return null;
  }

  return type;
}

function parseInput(type, body = {}) {
  const name = String(body.name || '').trim();

  if (!name) {
    throw new Error(`Escribe el nombre del ${type.label}`);
  }

  if (name.length > 50) {
    throw new Error('El nombre es demasiado largo (máximo 50 caracteres)');
  }

  if (!type.hasPrice) {
    return { name };
  }

  const price = Number(body.price);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Ingresa un precio válido');
  }

  return { name, price: Number(price.toFixed(2)) };
}

function friendlyError(error, type) {
  if (String(error.message || '').includes('UNIQUE')) {
    return `Ya existe un ${type.label} con ese nombre`;
  }

  return error.message || `No se pudo guardar el ${type.label}`;
}


// =========================================================
// LISTAR TODO EL CATÁLOGO (incluye inactivos)
// =========================================================

router.get('/', auth, admin, (req, res) => {
  const result = {};

  for (const [key, type] of Object.entries(TYPES)) {
    result[key] = db
      .prepare(`SELECT * FROM ${type.table} ORDER BY name COLLATE NOCASE`)
      .all();
  }

  res.json(result);
});


// =========================================================
// CREAR
// =========================================================

router.post('/:type', auth, admin, (req, res) => {
  const type = getType(req, res);
  if (!type) return;

  try {
    const data = parseInput(type, req.body);

    const result = type.hasPrice
      ? db.prepare(`INSERT INTO ${type.table}(name, price) VALUES (?, ?)`).run(data.name, data.price)
      : db.prepare(`INSERT INTO ${type.table}(name) VALUES (?)`).run(data.name);

    log(req.user.id, 'CATALOG_CREATE', `${type.label}: ${data.name}`);

    res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });

  } catch (error) {
    res.status(400).json({ error: friendlyError(error, type) });
  }
});


// =========================================================
// MODIFICAR (nombre, precio o activo)
// =========================================================

router.patch('/:type/:id', auth, admin, (req, res) => {
  const type = getType(req, res);
  if (!type) return;

  const id = Number(req.params.id);
  const current = db.prepare(`SELECT * FROM ${type.table} WHERE id = ?`).get(id);

  if (!current) {
    return res.status(404).json({ error: `No se encontró el ${type.label}` });
  }

  try {
    const body = req.body || {};

    if (Object.keys(body).length === 1 && 'active' in body) {
      db.prepare(`UPDATE ${type.table} SET active = ? WHERE id = ?`).run(body.active ? 1 : 0, id);
    } else {
      const data = parseInput(type, { ...current, ...body });

      if (type.hasPrice) {
        db.prepare(`UPDATE ${type.table} SET name = ?, price = ? WHERE id = ?`).run(data.name, data.price, id);
      } else {
        db.prepare(`UPDATE ${type.table} SET name = ? WHERE id = ?`).run(data.name, id);
      }
    }

    log(req.user.id, 'CATALOG_UPDATE', `${type.label}: ${current.name}`);

    res.json({ ok: true });

  } catch (error) {
    res.status(400).json({ error: friendlyError(error, type) });
  }
});


// =========================================================
// ELIMINAR
// =========================================================

router.delete('/:type/:id', auth, admin, (req, res) => {
  const type = getType(req, res);
  if (!type) return;

  const id = Number(req.params.id);
  const current = db.prepare(`SELECT * FROM ${type.table} WHERE id = ?`).get(id);

  if (!current) {
    return res.status(404).json({ error: `No se encontró el ${type.label}` });
  }

  db.prepare(`DELETE FROM ${type.table} WHERE id = ?`).run(id);

  log(req.user.id, 'CATALOG_DELETE', `${type.label}: ${current.name}`);

  res.json({ ok: true });
});

export default router;
