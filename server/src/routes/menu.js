import express from 'express';
import { db } from '../db.js';
import { auth } from '../middleware/auth.js';
import { livePromotions } from '../services/promotionService.js';
import { withSizes } from '../services/productService.js';

const router = express.Router();

router.get('/', auth, (req, res) => {
  try {
    const products = db
      .prepare(`
        SELECT *
        FROM products
        WHERE active = 1
        ORDER BY id
      `)
      .all()
      .map(withSizes);

    const flavors = db
      .prepare(`
        SELECT *
        FROM flavors
        WHERE active = 1
        ORDER BY id
      `)
      .all();

    const beverages = db
      .prepare(`
        SELECT *
        FROM beverages
        WHERE active = 1
        ORDER BY id
      `)
      .all();

    const extras = db
      .prepare(`
        SELECT *
        FROM extras
        WHERE active = 1
        ORDER BY id
      `)
      .all();

    // Solo promociones activas, dentro de sus fechas y con
    // al menos una opción disponible.
    const promotions = livePromotions();

    res.json({
      products,
      flavors,
      beverages,
      extras,
      promotions
    });

  } catch (error) {
    console.error('Error cargando menú:', error);

    res.status(500).json({
      error: error.message || 'No se pudo cargar el menú'
    });
  }
});

export default router;