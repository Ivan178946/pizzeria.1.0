import express from 'express';
import { db } from '../db.js';
import { auth, admin } from '../middleware/auth.js';
import { log } from '../utils/audit.js';

const router = express.Router();

/* =========================================================
   LISTAR JORNADAS
========================================================= */

router.get('/', auth, (req, res) => {
  try {
    const shifts = db.prepare(`
      SELECT *
      FROM shifts
      ORDER BY shift_date DESC, id DESC
    `).all();

    const fixedShifts = shifts.map(shift => {
      let sales = [];

      try {
        sales = JSON.parse(
          shift.sales_json || '[]'
        );
      } catch {
        sales = [];
      }

      /*
       * =====================================================
       * RECALCULAR EL HISTÓRICO DESDE LAS VENTAS REALES
       * =====================================================
       *
       * Ejemplo:
       *
       * Venta 1 = Bs 60 QR
       * Venta 2 = Bs 19 efectivo
       *
       * Total = Bs 79
       */

      const total = sales.reduce(
        (sum, sale) =>
          sum + Number(sale.total || 0),
        0
      );

      const qr = sales.reduce(
        (sum, sale) =>
          sum + Number(sale.qr || 0),
        0
      );

      /*
       * EFECTIVO REAL:
       *
       * efectivo recibido - vuelto
       */

      const cash = sales.reduce(
        (sum, sale) => {

          const efectivo =
            Number(sale.cash || 0);

          const vuelto =
            Number(sale.change || 0);

          return sum + efectivo - vuelto;
        },
        0
      );

      /*
       * TOTAL RECAUDADO
       */

      const totalRecaudado =
        cash + qr;

      return {
        ...shift,

        /*
         * Reemplazamos los valores antiguos
         * por los valores calculados desde
         * las ventas reales.
         */

        total,
        cash_sales: cash,
        qr_sales: qr,
        cash_expected: cash,

        orders_count: sales.length,

        /*
         * También enviamos el total correcto.
         */

        total_recaudado: totalRecaudado
      };
    });

    res.json(fixedShifts);

  } catch (error) {

    console.error(
      'Error cargando histórico de jornadas:',
      error
    );

    res.status(500).json({
      error:
        'No se pudo cargar el histórico de jornadas'
    });
  }
});


/* =========================================================
   CERRAR JORNADA
========================================================= */

router.post('/close', auth, (req, res) => {
  try {
    const date = String(req.body?.date || '');
    const notes = String(req.body?.notes || '');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Seleccione una fecha válida');
    }

    /* No permitir dos cierres para el mismo día */
    const existing = db.prepare(`
      SELECT id
      FROM shifts
      WHERE shift_date = ?
    `).get(date);

    if (existing) {
      throw new Error(
        'La jornada de esa fecha ya está cerrada'
      );
    }

    /* =====================================================
       OBTENER LAS VENTAS DEL DÍA
    ===================================================== */

    const orders = db.prepare(`
      SELECT
        o.*,
        COALESCE(
          u.name,
          'Usuario eliminado'
        ) AS user_name
      FROM orders o
      LEFT JOIN users u
        ON u.id = o.user_id
      WHERE COALESCE(
        o.order_date,
        date(o.created_at)
      ) = ?
      ORDER BY o.id ASC
    `).all(date);


    /* =====================================================
       EFECTIVO REAL
       
       Ejemplo:
       Venta = 19
       Cliente entrega = 100
       Vuelto = 81

       EFECTIVO REAL = 100 - 81 = 19
    ===================================================== */

    const cash = orders.reduce(
      (sum, order) => {

        const recibido = Number(
          order.cash || 0
        );

        const vuelto = Number(
          order.change_amount || 0
        );

        return sum + recibido - vuelto;
      },
      0
    );


    /* =====================================================
       QR REAL
    ===================================================== */

    const qr = orders.reduce(
      (sum, order) => {

        return sum + Number(
          order.qr || 0
        );

      },
      0
    );


    /* =====================================================
       TOTAL REAL DE VENTAS
       
       SI VENDISTE:
       Bs 60
       Bs 19

       TOTAL = Bs 79
    ===================================================== */

    const total = orders.reduce(
      (sum, order) => {

        return sum + Number(
          order.total || 0
        );

      },
      0
    );


    /* =====================================================
       COMPROBACIÓN
       
       EFECTIVO + QR DEBE COINCIDIR CON EL TOTAL
    ===================================================== */

    const totalRecaudado = cash + qr;


    /* =====================================================
       GUARDAR DETALLE DE VENTAS
    ===================================================== */

    const sales = orders.map(order => {

      let items = [];

      try {
        items = JSON.parse(
          order.items_json || '[]'
        );
      } catch {
        items = [];
      }

      return {
        id: order.id,
        orderNo: order.order_code || order.order_no,
        paymentMethod: order.payment_method || '',
        userName: order.user_name,
        createdAt: order.created_at,

        total: Number(
          order.total || 0
        ),

        cash: Number(
          order.cash || 0
        ),

        qr: Number(
          order.qr || 0
        ),

        change: Number(
          order.change_amount || 0
        ),

        items
      };
    });


    /* =====================================================
       GUARDAR CIERRE
    ===================================================== */

    const result = db.prepare(`
      INSERT INTO shifts(
        shift_date,
        total,
        cash_sales,
        qr_sales,
        cash_expected,
        cash_counted,
        notes,
        staff_json,
        closed_by,
        closed_at,
        sales_json,
        orders_count
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        NULL,
        ?,
        ?,
        ?,
        datetime('now', 'localtime'),
        ?,
        ?
      )
    `).run(
      date,
      total,
      cash,
      qr,
      cash,
      notes,
      JSON.stringify([]),
      req.user.id,
      JSON.stringify(sales),
      orders.length
    );


    /* =====================================================
       MARCAR VENTAS COMO CERRADAS
    ===================================================== */

    if (orders.length > 0) {

      const mark = db.prepare(`
        UPDATE orders
        SET closed = 1
        WHERE id = ?
      `);

      const transaction = db.transaction(ids => {
        ids.forEach(id => mark.run(id));
      });

      transaction(
        orders.map(order => order.id)
      );
    }


    /* =====================================================
       AUDITORÍA
    ===================================================== */

    log(
      req.user.id,
      'CLOSE_SHIFT',
      `${date} | Bs ${total} | ${orders.length} ventas`
    );


    /* =====================================================
       RESPUESTA
    ===================================================== */

    res.status(201).json({
      ok: true,
      id: Number(result.lastInsertRowid),
      date,

      /* Total de los precios de las ventas */
      total,

      /* Efectivo real después del vuelto */
      cash,

      /* QR */
      qr,

      /* Efectivo + QR */
      totalRecaudado,

      cashExpected: cash,
      cashCounted: null,

      orders: orders.length,

      sales
    });

  } catch (error) {

    res.status(400).json({
      error:
        error.message ||
        'No se pudo cerrar la jornada'
    });
  }
});


/* =========================================================
   ELIMINAR JORNADA
========================================================= */

router.delete('/:id', auth, admin, (req, res) => {

  const id = Number(
    req.params.id
  );

  const shift = db.prepare(`
    SELECT *
    FROM shifts
    WHERE id = ?
  `).get(id);

  if (!shift) {
    return res.status(404).json({
      error: 'La jornada no existe'
    });
  }

  db.prepare(`
    DELETE FROM shifts
    WHERE id = ?
  `).run(id);

  log(
    req.user.id,
    'DELETE_SHIFT',
    `Jornada ${shift.shift_date} eliminada`
  );

  res.json({
    ok: true
  });
});


export default router;