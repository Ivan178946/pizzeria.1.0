import { useEffect, useState } from 'react';

import {
  Banknote,
  CalendarDays,
  Clock3,
  CreditCard,
  Printer,
  QrCode,
  Receipt,
  ShoppingBag,
  UserRound,
  X
} from 'lucide-react';

import {
  itemDetailLines,
  itemsCount,
  money,
  orderCode,
  orderPaymentMethod,
  parseOrderDate,
  paymentMethodLabel
} from '../utils/format.js';

import {
  getTicketWidth,
  printReceipt,
  setTicketWidth
} from '../utils/print.js';

// =========================================================
// DETALLE COMPLETO DE UNA VENTA
// =========================================================

export default function OrderDetail({ order, items = [], onClose }) {
  const [width, setWidth] = useState(getTicketWidth);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const date = parseOrderDate(order.created_at ?? order.createdAt);
  const total = Number(order.total || 0);
  const cash = Number(order.cash || 0);
  const qr = Number(order.qr || 0);
  const change = Number(order.change_amount ?? order.change ?? 0);
  const method = orderPaymentMethod(order);
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0), 0);

  function chooseWidth(value) {
    setWidth(value);
    setTicketWidth(value);
  }

  async function print() {
    setPrinting(true);

    try {
      await printReceipt(order, items, width);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal modal-wide order-detail-modal" role="dialog" aria-label={`Detalle ${orderCode(order)}`}>

        <button className="modal-close" type="button" onClick={onClose} title="Cerrar">
          <X size={22} />
        </button>

        <span className="eyebrow">DETALLE DEL PEDIDO</span>

        <h2 className="od-code">
          <Receipt size={24} />
          {orderCode(order)}
        </h2>

        <div className="od-meta">
          <span>
            <CalendarDays size={14} />
            {date
              ? date.toLocaleDateString('es-BO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
              : '--'}
          </span>
          <span>
            <Clock3 size={14} />
            {date
              ? date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })
              : '--:--'}
          </span>
          {order.user_name && (
            <span>
              <UserRound size={14} />
              {order.user_name}
            </span>
          )}
          <span>
            <ShoppingBag size={14} />
            {itemsCount(items)} producto{itemsCount(items) === 1 ? '' : 's'}
          </span>
        </div>

        {/* ===================== PRODUCTOS ===================== */}

        <div className="od-table">
          <div className="od-row od-head">
            <span>Cant.</span>
            <span>Producto</span>
            <span>P. unit.</span>
            <span>Subtotal</span>
          </div>

          {items.length === 0 ? (
            <div className="od-empty">No se encontró el detalle de esta venta.</div>
          ) : (
            items.map((item, index) => {
              const qty = Number(item.quantity || 1);
              const lineTotal = Number(item.price || 0);
              const lines = itemDetailLines(item);

              return (
                <div className="od-row" key={item.uid || index}>
                  <span className="od-qty">{qty}x</span>
                  <span className="od-product">
                    <b>{item.name || 'Producto'}</b>
                    {lines.map((line, i) => (
                      <small key={i}>{line}</small>
                    ))}
                  </span>
                  <span className="od-money">{money(qty ? lineTotal / qty : lineTotal)}</span>
                  <span className="od-money od-strong">{money(lineTotal)}</span>
                </div>
              );
            })
          )}
        </div>

        {/* ======================= PAGO ======================== */}

        <div className="od-bottom">

          <div className="od-pay">
            <div className="od-pay-title">
              <CreditCard size={16} />
              Método de pago: <b className={`od-method ${method}`}>{paymentMethodLabel(method)}</b>
            </div>

            <div className="od-pay-grid">
              <div>
                <span><Banknote size={13} /> Efectivo</span>
                <strong>{money(cash)}</strong>
              </div>
              <div>
                <span><QrCode size={13} /> QR</span>
                <strong>{money(qr)}</strong>
              </div>
              <div>
                <span>Cambio</span>
                <strong>{money(change)}</strong>
              </div>
            </div>
          </div>

          <div className="od-totals">
            <div>
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <div className="od-grand">
              <span>Total</span>
              <b>{money(total)}</b>
            </div>
          </div>

        </div>

        {/* ===================== ACCIONES ====================== */}

        <div className="od-actions">
          <div className="segmented" title="Ancho del papel de la impresora térmica">
            {[80, 58].map(value => (
              <button
                key={value}
                type="button"
                className={width === value ? 'active' : ''}
                onClick={() => chooseWidth(value)}
              >
                {value} mm
              </button>
            ))}
          </div>

          <button className="secondary-button" type="button" onClick={onClose}>
            Cerrar
          </button>

          <button className="primary" type="button" onClick={print} disabled={printing}>
            <Printer size={17} />
            {printing ? 'Imprimiendo...' : 'Imprimir'}
          </button>
        </div>

      </div>
    </div>
  );
}
