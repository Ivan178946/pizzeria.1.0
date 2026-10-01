import { useMemo, useState } from 'react';

import {
  Banknote,
  Clock3,
  CreditCard,
  Eye,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Trash2
} from 'lucide-react';

import {
  money,
  itemDescription,
  itemsCount,
  orderCode,
  orderPaymentMethod,
  parseOrderDate
} from '../utils/format.js';
import { printReceipt } from '../utils/print.js';
import AnimatedNumber from './AnimatedNumber.jsx';
import OrderDetail from './OrderDetail.jsx';

const METHOD_BADGE = {
  cash: ['cash', 'Efectivo'],
  qr: ['qr', 'QR'],
  mixed: ['mixed', 'Mixto']
};

export default function Today({
  orders = [],
  isAdmin = false,
  onDelete
}) {
  const [openOrder, setOpenOrder] = useState(null);
  const [query, setQuery] = useState('');
  const [payFilter, setPayFilter] = useState('all');

  const visibleOrders = useMemo(() => {
    const text = query.trim().toLowerCase();

    return orders.filter(order => {
      const cash = Number(order.cash || 0);
      const qr = Number(order.qr || 0);

      if (payFilter === 'cash' && !(cash > 0)) return false;
      if (payFilter === 'qr' && !(qr > 0)) return false;

      if (!text) return true;

      const haystack = [
        order.order_code,
        order.order_no,
        order.orderNo,
        order.id,
        order.table_number,
        ...parseItems(order.items_json ?? order.items).map(
          item => `${item.name || ''} ${itemDescription(item)}`
        )
      ].join(' ').toLowerCase();

      return haystack.includes(text);
    });
  }, [orders, query, payFilter]);

  const summary = useMemo(() => {
    let total = 0;
    let cash = 0;
    let qr = 0;

    for (const order of orders) {
      const orderTotal = Number(order.total || 0);
      const orderCash = Number(order.cash || 0);
      const orderChange = Number(order.change_amount ?? order.change ?? 0);
      const orderQr = Number(order.qr || 0);

      total += orderTotal;

      // El efectivo real es lo recibido menos el vuelto.
      cash += Math.max(0, orderCash - orderChange);

      qr += orderQr;
    }

    return {
      total,
      cash,
      qr,
      orders: orders.length
    };
  }, [orders]);

  // Pedido abierto en el modal de detalle
  const detailOrder = openOrder === null
    ? null
    : orders.find(order => (order.id ?? order.order_no) === openOrder) || null;

  function printOrder(order) {
    printReceipt(order, parseItems(order.items_json ?? order.items));
  }

  return (
    <section className="today-page">

      <div className="today-heading">

        <div>
          <span className="eyebrow">
            CONTROL DE VENTAS
          </span>

          <h1>
            Ventas de hoy
          </h1>

          <p>
            Consulta y revisa todas las ventas realizadas durante la jornada.
          </p>
        </div>

        <div className="today-date">
          <Clock3 size={16} />
          <span>
            {formatToday()}
          </span>
        </div>

      </div>

      <div className="today-summary">

        <SummaryCard
          icon={Receipt}
          title="Ventas"
          value={summary.total}
          format={money}
          description="Total vendido"
        />

        <SummaryCard
          icon={ShoppingBag}
          title="Pedidos"
          value={summary.orders}
          description="Pedidos realizados"
        />

        <SummaryCard
          icon={Banknote}
          title="Efectivo"
          value={summary.cash}
          format={money}
          description="Efectivo real"
        />

        <SummaryCard
          icon={CreditCard}
          title="QR"
          value={summary.qr}
          format={money}
          description="Pagos por QR"
        />

      </div>

      <div className="today-list-header">

        <div className="today-list-title">
          <h2>
            Registro de ventas
          </h2>

          <span>
            {summary.orders === 0
              ? 'Todavía no hay ventas registradas.'
              : `${summary.orders} venta${summary.orders === 1 ? '' : 's'} registrada${summary.orders === 1 ? '' : 's'}.`
            }
          </span>
        </div>

        {orders.length > 0 && (
          <div className="list-toolbar">

            <label className="search-box">
              <Search size={16} />
              <input
                type="search"
                placeholder="Buscar pedido, producto o mesa..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </label>

            <div className="segmented">
              {[
                ['all', 'Todos'],
                ['cash', 'Efectivo'],
                ['qr', 'QR']
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={payFilter === id ? 'active' : ''}
                  onClick={() => setPayFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>

          </div>
        )}

      </div>

      {orders.length > 0 && visibleOrders.length === 0 && (
        <div className="today-no-results">
          <Search size={20} />
          <span>No hay ventas que coincidan con la búsqueda.</span>
        </div>
      )}

      {orders.length === 0 ? (

        <div className="today-empty">

          <div className="today-empty-icon">
            <Receipt size={30} />
          </div>

          <h3>
            No hay ventas todavía
          </h3>

          <p>
            Las ventas que registres desde el Punto de venta aparecerán aquí.
          </p>

        </div>

      ) : (

        <div className="today-orders">

          {visibleOrders.map((order, index) => {

            const id = order.id ?? order.order_no;

            const orderTotal =
              Number(order.total || 0);

            const items =
              parseItems(order.items_json ?? order.items);

            const count = itemsCount(items);

            const time =
              formatTime(
                order.created_at ??
                order.createdAt
              );

            const [badgeClass, badgeLabel] =
              METHOD_BADGE[orderPaymentMethod(order)] || METHOD_BADGE.cash;

            return (
              <article
                className="today-order-card"
                key={id}
                style={{ '--i': Math.min(index, 12) }}
              >

                <div className="today-order-main">

                  <div className="today-order-number">

                    <div className="today-order-icon">
                      <Receipt size={19} />
                    </div>

                    <div>
                      <strong>
                        {orderCode(order)}
                      </strong>

                      <span>
                        <Clock3 size={12} />
                        {time}
                      </span>
                    </div>

                  </div>

                  <div className="today-order-info">

                    <span>
                      {count} producto
                      {count === 1 ? '' : 's'}
                    </span>

                    {order.service_type && (
                      <span>
                        {serviceLabel(order.service_type)}
                      </span>
                    )}

                    {order.table_number && (
                      <span>
                        Mesa {order.table_number}
                      </span>
                    )}

                  </div>

                  <div className="today-order-payment">

                    <span className={`payment-badge ${badgeClass}`}>
                      {badgeLabel}
                    </span>

                  </div>

                  <div className="today-order-total">
                    {money(orderTotal)}
                  </div>

                  <div className="today-order-actions">

                    <button
                      type="button"
                      className="today-detail-button"
                      onClick={() => setOpenOrder(id)}
                    >
                      <Eye size={15} />
                      Detalle
                    </button>

                    <button
                      type="button"
                      className="today-detail-button today-print-button"
                      title="Imprimir ticket de este pedido"
                      onClick={() => printOrder(order)}
                    >
                      <Printer size={15} />
                      Imprimir
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        className="today-delete-button"
                        title="Eliminar venta"
                        onClick={() =>
                          onDelete?.(order.id)
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                  </div>

                </div>

              </article>
            );
          })}

        </div>

      )}

      {detailOrder && (
        <OrderDetail
          order={detailOrder}
          items={parseItems(detailOrder.items_json ?? detailOrder.items)}
          onClose={() => setOpenOrder(null)}
        />
      )}

    </section>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  format,
  description
}) {
  return (
    <div className="today-summary-card">

      <div className="today-summary-icon">
        <Icon size={21} />
      </div>

      <div className="today-summary-content">

        <span>
          {title}
        </span>

        <strong>
          <AnimatedNumber value={value} format={format} />
        </strong>

        <small>
          {description}
        </small>

      </div>

    </div>
  );
}

function parseItems(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function formatToday() {
  return new Intl.DateTimeFormat(
    'es-BO',
    {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  ).format(new Date());
}

function formatTime(value) {
  // created_at se guarda en hora local ("2026-10-01 10:13:10")
  const date = parseOrderDate(value);

  if (!date) {
    return '--:--';
  }

  return new Intl.DateTimeFormat(
    'es-BO',
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date);
}

function serviceLabel(value) {
  const labels = {
    takeaway: 'Para llevar',
    local: 'En local',
    delivery: 'Delivery'
  };

  return labels[value] || value;
}