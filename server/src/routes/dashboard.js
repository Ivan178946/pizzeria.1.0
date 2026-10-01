import express from 'express';
import { db } from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

/*
  DASHBOARD DE VENTAS

  Este módulo obtiene la información directamente
  desde la tabla orders.

  Efectivo real:
  efectivo recibido - vuelto

  QR:
  monto pagado por QR

  Total:
  efectivo real + QR
*/

// GET /api/dashboard
router.get('/', auth, (req, res) => {
  try {
    // Solo administrador
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permisos para acceder al dashboard'
      });
    }

    // -----------------------------------------
    // VENTAS DE HOY
    // -----------------------------------------

    const today = db.prepare(`
      SELECT
        COUNT(*) AS orders_count,
        COALESCE(SUM(total), 0) AS total,
        COALESCE(SUM(cash - change_amount), 0) AS cash,
        COALESCE(SUM(qr), 0) AS qr
      FROM orders
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `).get();

    // -----------------------------------------
    // VENTAS DEL MES
    // -----------------------------------------

    const month = db.prepare(`
      SELECT
        COUNT(*) AS orders_count,
        COALESCE(SUM(total), 0) AS total
      FROM orders
      WHERE strftime('%Y-%m', created_at, 'localtime')
        = strftime('%Y-%m', 'now', 'localtime')
    `).get();

    // -----------------------------------------
    // TICKET PROMEDIO
    // -----------------------------------------

    const ticketAverage =
      Number(month.orders_count || 0) > 0
        ? Number(month.total || 0) / Number(month.orders_count)
        : 0;

    // -----------------------------------------
    // PRODUCTO MÁS VENDIDO
    // -----------------------------------------

    const orders = db.prepare(`
      SELECT items_json
      FROM orders
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `).all();

    const productCounts = {};
    const flavorCounts = {};

    for (const order of orders) {
      let items = [];

      try {
        items = JSON.parse(order.items_json || '[]');
      } catch {
        items = [];
      }

      for (const item of items) {
        const productName =
          item.productName ||
          item.name ||
          item.product ||
          'Producto';

        const quantity = Number(item.quantity || 1);

        productCounts[productName] =
          (productCounts[productName] || 0) + quantity;

        // -----------------------------------------
        // SABORES
        // -----------------------------------------

        if (Array.isArray(item.flavors)) {
          for (const flavor of item.flavors) {
            if (!flavor) continue;

            const flavorName =
              typeof flavor === 'string'
                ? flavor
                : flavor.name;

            if (!flavorName) continue;

            flavorCounts[flavorName] =
              (flavorCounts[flavorName] || 0) + quantity;
          }
        }

        // También revisamos pizzas internas de promociones
        if (Array.isArray(item.pizzas)) {
          for (const pizza of item.pizzas) {
            if (Array.isArray(pizza.flavors)) {
              for (const flavor of pizza.flavors) {
                if (!flavor) continue;

                const flavorName =
                  typeof flavor === 'string'
                    ? flavor
                    : flavor.name;

                if (!flavorName) continue;

                flavorCounts[flavorName] =
                  (flavorCounts[flavorName] || 0) + 1;
              }
            }
          }
        }
      }
    }

    function getTop(counts) {
      const entries = Object.entries(counts);

      if (!entries.length) {
        return {
          name: 'Sin datos',
          quantity: 0
        };
      }

      entries.sort((a, b) => b[1] - a[1]);

      return {
        name: entries[0][0],
        quantity: entries[0][1]
      };
    }

    const topProduct = getTop(productCounts);
    const topFlavor = getTop(flavorCounts);

    // -----------------------------------------
    // VENTAS DE LOS ÚLTIMOS 7 DÍAS
    // -----------------------------------------

    const last7Days = db.prepare(`
      SELECT
        date(created_at, 'localtime') AS date,
        COUNT(*) AS orders_count,
        COALESCE(SUM(total), 0) AS total
      FROM orders
      WHERE date(created_at, 'localtime')
        >= date('now', 'localtime', '-6 days')
      GROUP BY date(created_at, 'localtime')
      ORDER BY date ASC
    `).all();

    // -----------------------------------------
    // COMPLETAR DÍAS SIN VENTAS
    // -----------------------------------------

    const salesByDate = {};

    for (const row of last7Days) {
      salesByDate[row.date] = {
        total: Number(row.total || 0),
        orders: Number(row.orders_count || 0)
      };
    }

    const chart = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();

      d.setDate(d.getDate() - i);

      const year = d.getFullYear();
      const monthNumber = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      const isoDate = `${year}-${monthNumber}-${day}`;

      const data = salesByDate[isoDate] || {
        total: 0,
        orders: 0
      };

      const label = `${day}/${monthNumber}`;

      chart.push({
        date: isoDate,
        label,
        total: Number(data.total || 0),
        orders: Number(data.orders || 0)
      });
    }

    // -----------------------------------------
    // RESPUESTA
    // -----------------------------------------

    res.json({
      today: {
        total: Number(today.total || 0),
        orders: Number(today.orders_count || 0),
        cash: Number(today.cash || 0),
        qr: Number(today.qr || 0)
      },

      month: {
        total: Number(month.total || 0),
        orders: Number(month.orders_count || 0),
        averageTicket: Number(ticketAverage || 0)
      },

      topProduct,
      topFlavor,

      chart
    });

  } catch (error) {
    console.error('Error en dashboard:', error);

    res.status(500).json({
      error: 'No se pudo cargar el dashboard'
    });
  }
});

export default router;