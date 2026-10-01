import express from 'express';
import { db } from '../db.js';
import { auth, admin } from '../middleware/auth.js';
import { log } from '../utils/audit.js';
import {
  validateItems,
  validatePayment
} from '../services/orderService.js';
import { paymentSettings } from './settings.js';

const router = express.Router();


/* =========================================================
   MÉTODO DE PAGO
========================================================= */

export function paymentMethodOf(cash, qr) {
  if (cash > 0 && qr > 0) return 'mixed';
  if (qr > 0) return 'qr';
  return 'cash';
}


/* =========================================================
   CÓDIGO DE PEDIDO: KIKIS-000001
   - El número se reinicia cada día.
   - El contador vive en "order_counters" y se incrementa
     dentro de una transacción IMMEDIATE junto con el INSERT,
     así dos ventas simultáneas nunca obtienen el mismo número
     (y el índice único order_date + daily_seq lo garantiza).
   - Se usa un contador y no COUNT(*) para que, si se elimina
     una venta, su número no se vuelva a repetir ese día.
   - order_no guarda un identificador interno único
     (KIKIS-20261001-000001); el usuario ve order_code.
========================================================= */

const nextSequence = db.prepare(`
  INSERT INTO order_counters(day, last_seq)
  VALUES (
    ?,
    COALESCE((SELECT MAX(daily_seq) FROM orders WHERE order_date = ?), 0) + 1
  )
  ON CONFLICT(day) DO UPDATE SET last_seq = last_seq + 1
  RETURNING last_seq
`);

const insertOrder = db.prepare(`
  INSERT INTO orders(
    order_no,
    order_code,
    order_date,
    daily_seq,
    payment_method,
    user_id,
    total,
    cash,
    qr,
    change_amount,
    items_json,
    created_at,
    closed
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
`);

const createOrder = db.transaction(({ userId, payment, items }) => {
  // Fecha y hora local tomadas una sola vez para que la
  // fecha del pedido y su hora siempre coincidan.
  const { stamp } = db.prepare(
    "SELECT datetime('now','localtime') AS stamp"
  ).get();

  const day = stamp.slice(0, 10);
  const seq = nextSequence.get(day, day).last_seq;
  const number = String(seq).padStart(6, '0');

  const orderCode = `KIKIS-${number}`;
  const orderNo = `KIKIS-${day.replace(/-/g, '')}-${number}`;
  const paymentMethod = paymentMethodOf(payment.cash, payment.qr);

  const result = insertOrder.run(
    orderNo,
    orderCode,
    day,
    seq,
    paymentMethod,
    userId,
    payment.total,
    payment.cash,
    payment.qr,
    payment.change,
    JSON.stringify(items),
    stamp
  );

  return {
    id: Number(result.lastInsertRowid),
    orderNo,
    orderCode,
    orderDate: day,
    createdAt: stamp,
    paymentMethod
  };
});


/* =========================================================
   REGISTRAR VENTA
========================================================= */

router.post('/', auth, (req, res) => {

  try {

    const {
      items,
      total,
      cash = 0,
      qr = 0
    } = req.body || {};


    /* -------------------------------------------------------
       VALIDAR PRODUCTOS
    ------------------------------------------------------- */

    validateItems(items);


    /* -------------------------------------------------------
       VALIDAR PAGO
    ------------------------------------------------------- */

    const payment = validatePayment(
      total,
      cash,
      qr
    );


    /* -------------------------------------------------------
       PAGO QR DESACTIVADO POR EL ADMINISTRADOR
    ------------------------------------------------------- */

    if (payment.qr > 0 && !paymentSettings().qrEnabled) {
      throw new Error('El pago por QR está desactivado. Cobra en efectivo.');
    }


    /* -------------------------------------------------------
       GUARDAR VENTA CON SU CÓDIGO DEL DÍA
    ------------------------------------------------------- */

    const order = createOrder.immediate({
      userId: req.user.id,
      payment,
      items
    });


    /* -------------------------------------------------------
       AUDITORÍA
    ------------------------------------------------------- */

    log(
      req.user.id,
      'ORDER',
      `${order.orderCode} (${order.orderDate}) | Total Bs ${payment.total} | Efectivo Bs ${payment.cash} | QR Bs ${payment.qr} | Vuelto Bs ${payment.change}`
    );


    /* -------------------------------------------------------
       RESPUESTA
    ------------------------------------------------------- */

    res.status(201).json({

      ok: true,

      id: order.id,

      // El código visible del día: KIKIS-000001
      orderNo: order.orderCode,
      orderCode: order.orderCode,
      orderDate: order.orderDate,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,

      total: payment.total,
      cash: payment.cash,
      qr: payment.qr,
      change: payment.change

    });

  } catch (error) {

    console.error(
      'Error registrando venta:',
      error
    );

    res.status(400).json({

      error:
        error.message ||
        'No se pudo registrar la venta'

    });

  }

});


/* =========================================================
   VENTAS DE HOY
========================================================= */

router.get('/today', auth, (req, res) => {

  try {

    const orders = db.prepare(`
      SELECT
        o.id,
        o.order_no,
        COALESCE(o.order_code, o.order_no) AS order_code,
        o.order_date,
        o.daily_seq,
        o.payment_method,
        o.user_id,
        o.total,
        o.cash,
        o.qr,
        o.change_amount,
        o.items_json,
        o.created_at,
        o.closed,

        COALESCE(
          u.name,
          'Usuario eliminado'
        ) AS user_name

      FROM orders o

      LEFT JOIN users u
        ON u.id = o.user_id

      -- created_at ya está en hora local
      WHERE COALESCE(
        o.order_date,
        date(o.created_at)
      ) = date(
        'now',
        'localtime'
      )

      ORDER BY o.id DESC
    `).all();


    res.json(orders);

  } catch (error) {

    console.error(
      'Error cargando ventas:',
      error
    );

    res.status(500).json({

      error:
        'No se pudieron cargar las ventas'

    });

  }

});


/* =========================================================
   ELIMINAR VENTA
========================================================= */

router.delete(
  '/:id',
  auth,
  admin,
  (req, res) => {

    const id = Number(
      req.params.id
    );


    const order = db.prepare(`
      SELECT *
      FROM orders
      WHERE id = ?
    `).get(id);


    if (!order) {

      return res.status(404).json({

        error:
          'Venta no encontrada'

      });

    }


    db.prepare(`
      DELETE FROM orders
      WHERE id = ?
    `).run(id);


    log(
      req.user.id,
      'DELETE_ORDER',
      `${order.order_code || order.order_no} eliminado`
    );


    res.json({
      ok: true
    });

  }
);


export default router;