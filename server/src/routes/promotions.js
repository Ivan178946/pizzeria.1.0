import express from 'express';

import { db } from '../db.js';
import { auth, admin } from '../middleware/auth.js';
import { log } from '../utils/audit.js';
import {
  deleteOptions,
  findPromotion,
  parsePromotionInput,
  replaceOptions,
  toPromotion
} from '../services/promotionService.js';

const router = express.Router();

function describe(data) {
  return data.options
    .map(o => `${o.name} Bs ${o.promoPrice}`)
    .join(', ');
}


// =========================================================
// LISTAR PROMOCIONES (activas y pausadas)
// =========================================================

router.get('/', auth, admin, (req, res) => {
  const promotions = db
    .prepare('SELECT * FROM promotions ORDER BY id DESC')
    .all()
    .map(toPromotion);

  res.json(promotions);
});


// =========================================================
// CREAR PROMOCIÓN CON SUS OPCIONES
// =========================================================

const createPromotion = db.transaction(data => {
  const result = db.prepare(`
    INSERT INTO promotions(name, description, emoji, image, price, components_json, active, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?)
  `).run(
    data.title,
    data.description,
    data.emoji,
    data.image,
    // "price" queda por compatibilidad: el precio más bajo de las opciones
    Math.min(...data.options.map(o => o.promoPrice)),
    data.active,
    data.startDate,
    data.endDate
  );

  const id = Number(result.lastInsertRowid);

  replaceOptions(id, data.options);

  return id;
});

router.post('/', auth, admin, (req, res) => {
  try {
    const data = parsePromotionInput(req.body);
    const id = createPromotion(data);

    log(req.user.id, 'CREATE_PROMO', `${data.title} | ${describe(data)}`);

    res.status(201).json(findPromotion(id));

  } catch (error) {
    res.status(400).json({
      error: error.message || 'No se pudo crear la promoción'
    });
  }
});


// =========================================================
// MODIFICAR PROMOCIÓN
// Si solo llega "active", únicamente se pausa o reactiva.
// =========================================================

const updatePromotion = db.transaction((id, data) => {
  db.prepare(`
    UPDATE promotions
    SET name = ?, description = ?, emoji = ?, image = ?, price = ?,
        active = ?, start_date = ?, end_date = ?
    WHERE id = ?
  `).run(
    data.title,
    data.description,
    data.emoji,
    data.image,
    Math.min(...data.options.map(o => o.promoPrice)),
    data.active,
    data.startDate,
    data.endDate,
    id
  );

  replaceOptions(id, data.options);
});

router.patch('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  const current = findPromotion(id);

  if (!current) {
    return res.status(404).json({ error: 'Promoción no encontrada' });
  }

  try {
    const body = req.body || {};
    const onlyActive = Object.keys(body).length === 1 && 'active' in body;

    if (onlyActive) {
      const active = body.active ? 1 : 0;

      db.prepare('UPDATE promotions SET active = ? WHERE id = ?').run(active, id);

      log(
        req.user.id,
        'TOGGLE_PROMO',
        `${current.title} ${active ? 'activada' : 'pausada'}`
      );

      return res.json(findPromotion(id));
    }

    const data = parsePromotionInput(body);

    updatePromotion(id, data);

    log(req.user.id, 'UPDATE_PROMO', `${data.title} | ${describe(data)}`);

    res.json(findPromotion(id));

  } catch (error) {
    res.status(400).json({
      error: error.message || 'No se pudo actualizar la promoción'
    });
  }
});


// =========================================================
// ACTIVAR / DESACTIVAR UNA OPCIÓN
// =========================================================

router.patch('/:id/options/:optionId', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  const optionId = Number(req.params.optionId);
  const current = findPromotion(id);
  const option = current?.options.find(o => o.id === optionId);

  if (!option) {
    return res.status(404).json({ error: 'Opción no encontrada' });
  }

  const active = req.body?.active ? 1 : 0;

  db.prepare('UPDATE promotion_options SET active = ? WHERE id = ?').run(active, optionId);

  log(
    req.user.id,
    'TOGGLE_PROMO_OPTION',
    `${current.title} / ${option.name} ${active ? 'activada' : 'pausada'}`
  );

  res.json(findPromotion(id));
});


// =========================================================
// ELIMINAR PROMOCIÓN
// Las ventas ya registradas guardan su propia copia del
// detalle, así que eliminarla no afecta al historial.
// =========================================================

router.delete('/:id', auth, admin, (req, res) => {
  const id = Number(req.params.id);
  const current = findPromotion(id);

  if (!current) {
    return res.status(404).json({ error: 'Promoción no encontrada' });
  }

  db.transaction(() => {
    deleteOptions(id);
    db.prepare('DELETE FROM promotions WHERE id = ?').run(id);
  })();

  log(req.user.id, 'DELETE_PROMO', current.title);

  res.json({ ok: true });
});

export default router;
