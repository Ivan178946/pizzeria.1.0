import { useMemo, useState } from 'react';

import {
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CreditCard,
  Eye,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';

import { api } from '../services/api.js';
import { money, itemDescription } from '../utils/format.js';

export default function Shifts({
  shifts = [],
  user,
  reload
}) {
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [openShift, setOpenShift] = useState(null);
  const [detailShift, setDetailShift] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => {
      return String(b.shift_date || b.date || '')
        .localeCompare(
          String(a.shift_date || a.date || '')
        );
    });
  }, [shifts]);

  async function saveShift() {
    if (saving) return;

    setSaving(true);
    setMessage('');

    try {
      const result = await api(
        '/api/admin/shifts/close',
        {
          method: 'POST',
          body: JSON.stringify({
            date,
            notes
          })
        }
      );

      setMessage(
        `✓ Jornada ${date} guardada correctamente. Total: ${money(result.total)}`
      );

      setNotes('');

      reload?.();

    } catch (error) {
      console.error(
        'Error guardando jornada:',
        error
      );

      setMessage(
        `Error: ${error.message}`
      );

    } finally {
      setSaving(false);
    }
  }

  async function deleteShift(id) {
    if (!isAdmin) {
      return;
    }

    const confirmed = window.confirm(
      '¿Seguro que deseas eliminar este cierre de jornada?'
    );

    if (!confirmed) {
      return;
    }

    try {
      await api(
        `/api/admin/shifts/${id}`,
        {
          method: 'DELETE'
        }
      );

      if (openShift === id) {
        setOpenShift(null);
      }

      if (detailShift?.id === id) {
        setDetailShift(null);
      }

      setMessage(
        '✓ Jornada eliminada correctamente.'
      );

      reload?.();

    } catch (error) {
      setMessage(
        `Error: ${error.message}`
      );
    }
  }

  function toggleShift(id) {
    setOpenShift(current =>
      current === id
        ? null
        : id
    );
  }

  return (
    <section className="shifts-page">

      <div className="shifts-heading">

        <div>
          <span className="eyebrow">
            CONTROL DE JORNADAS
          </span>

          <h1>
            Cierre de jornada
          </h1>

          <p>
            Guarda y consulta el resumen de ventas de cada jornada.
          </p>
        </div>

      </div>

      {message && (
        <div
          className={
            message.startsWith('Error')
              ? 'shift-message error'
              : 'shift-message'
          }
        >
          {message}
        </div>
      )}

      <div className="shift-save-card">

        <div className="shift-save-info">

          <div className="shift-save-icon">
            <CalendarDays size={23} />
          </div>

          <div>

            <h2>
              Guardar jornada
            </h2>

            <p>
              El sistema tomará automáticamente las ventas realizadas en la fecha seleccionada.
            </p>

          </div>

        </div>

        <div className="shift-save-form">

          <label>
            Fecha

            <input
              type="date"
              value={date}
              onChange={e =>
                setDate(e.target.value)
              }
            />
          </label>

          <label>
            Notas

            <textarea
              value={notes}
              onChange={e =>
                setNotes(e.target.value)
              }
              placeholder="Observaciones de la jornada..."
              rows={3}
            />
          </label>

          <button
            type="button"
            className="shift-save-button"
            onClick={saveShift}
            disabled={saving}
          >
            <ClipboardList size={17} />

            {saving
              ? 'Guardando...'
              : 'Cerrar y guardar jornada'
            }
          </button>

        </div>

      </div>

      <div className="shift-history-header">

        <div>
          <span className="eyebrow">
            HISTÓRICO
          </span>

          <h2>
            Jornadas cerradas
          </h2>

          <p>
            {sortedShifts.length === 0
              ? 'Todavía no existen jornadas cerradas.'
              : `${sortedShifts.length} jornada${sortedShifts.length === 1 ? '' : 's'} registrada${sortedShifts.length === 1 ? '' : 's'}.`
            }
          </p>
        </div>

        <button
          type="button"
          className="shift-refresh-button"
          onClick={() => reload?.()}
          title="Actualizar"
        >
          <RefreshCw size={16} />
        </button>

      </div>

      {sortedShifts.length === 0 ? (

        <div className="shift-empty">

          <div className="shift-empty-icon">
            <CalendarDays size={30} />
          </div>

          <h3>
            No hay jornadas cerradas
          </h3>

          <p>
            Cuando cierres una jornada aparecerá aquí.
          </p>

        </div>

      ) : (

        <div className="shift-history-list">

          {sortedShifts.map((shift, index) => {

            const shiftId =
              shift.id;

            const shiftDate =
              shift.shift_date ||
              shift.date;

            const sales =
              parseSales(
                shift.sales_json ??
                shift.sales
              );

            const total =
              calculateTotal(
                shift,
                sales
              );

            const cash =
              calculateCash(
                shift,
                sales
              );

            const qr =
              calculateQr(
                shift,
                sales
              );

            const orderCount =
              Number(
                shift.orders_count ??
                shift.ordersCount ??
                sales.length ??
                0
              );

            const isOpen =
              openShift === shiftId;

            return (
              <article
                className={
                  isOpen
                    ? 'shift-history-card open'
                    : 'shift-history-card'
                }
                key={shiftId}
                style={{ '--i': Math.min(index, 12) }}
              >

                <div className="shift-card-main">

                  <div className="shift-card-date">

                    <div className="shift-date-icon">
                      <CalendarDays size={19} />
                    </div>

                    <div>
                      <strong>
                        {formatDate(shiftDate)}
                      </strong>

                      <span>
                        Jornada cerrada
                      </span>
                    </div>

                  </div>

                  <div className="shift-card-total">

                    <span>
                      Total recaudado
                    </span>

                    <strong>
                      {money(total)}
                    </strong>

                  </div>

                  <div className="shift-card-count">

                    <ClipboardList size={17} />

                    <div>
                      <strong>
                        {orderCount}
                      </strong>

                      <span>
                        ventas
                      </span>
                    </div>

                  </div>

                  <button
                    type="button"
                    className="shift-view-button"
                    onClick={() =>
                      toggleShift(shiftId)
                    }
                  >
                    {isOpen ? (
                      <>
                        Ocultar
                        <ChevronUp size={16} />
                      </>
                    ) : (
                      <>
                        Resumen
                        <ChevronDown size={16} />
                      </>
                    )}
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      className="shift-delete-button"
                      onClick={() =>
                        deleteShift(shiftId)
                      }
                      title="Eliminar jornada"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                </div>

                {isOpen && (

                  <div className="shift-card-expanded">

                    <div className="shift-financial-grid">

                      <div className="shift-financial-item">

                        <div className="shift-financial-icon cash">
                          <Banknote size={17} />
                        </div>

                        <div>
                          <span>
                            Efectivo
                          </span>

                          <strong>
                            {money(cash)}
                          </strong>
                        </div>

                      </div>

                      <div className="shift-financial-item">

                        <div className="shift-financial-icon qr">
                          <CreditCard size={17} />
                        </div>

                        <div>
                          <span>
                            QR
                          </span>

                          <strong>
                            {money(qr)}
                          </strong>
                        </div>

                      </div>

                      <div className="shift-financial-item">

                        <div className="shift-financial-icon orders">
                          <ClipboardList size={17} />
                        </div>

                        <div>
                          <span>
                            Pedidos
                          </span>

                          <strong>
                            {orderCount}
                          </strong>
                        </div>

                      </div>

                    </div>

                    {shift.notes && (
                      <div className="shift-notes">
                        <b>
                          Notas
                        </b>

                        <span>
                          {shift.notes}
                        </span>
                      </div>
                    )}

                    <div className="shift-sales-header">

                      <div>
                        <h3>
                          Ventas de la jornada
                        </h3>

                        <span>
                          {sales.length} venta
                          {sales.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {sales.length > 0 && (
                        <button
                          type="button"
                          className="shift-detail-button"
                          onClick={() =>
                            setDetailShift(shift)
                          }
                        >
                          <Eye size={15} />
                          Ver detalle completo
                        </button>
                      )}

                    </div>

                    {sales.length === 0 ? (

                      <div className="shift-no-sales">
                        No hay ventas detalladas guardadas en esta jornada.
                      </div>

                    ) : (

                      <div className="shift-mini-sales">

                        {sales
                          .slice(0, 5)
                          .map(
                            (sale, index) => (
                              <MiniSale
                                key={
                                  sale.id ||
                                  sale.order_no ||
                                  sale.orderNo ||
                                  index
                                }
                                sale={sale}
                                index={index}
                              />
                            )
                          )}

                        {sales.length > 5 && (
                          <button
                            type="button"
                            className="shift-more-sales"
                            onClick={() =>
                              setDetailShift(shift)
                            }
                          >
                            Ver las {sales.length} ventas de esta jornada →
                          </button>
                        )}

                      </div>

                    )}

                  </div>

                )}

              </article>
            );
          })}

        </div>

      )}

      {detailShift && (

        <SaleDetailModal
          shift={detailShift}
          onClose={() =>
            setDetailShift(null)
          }
        />

      )}

    </section>
  );
}

function MiniSale({
  sale,
  index
}) {
  const items =
    parseItems(
      sale.items_json ??
      sale.items
    );

  const total =
    Number(
      sale.total ||
      0
    );

  const orderNumber =
    sale.order_no ||
    sale.orderNo ||
    `#${String(
      sale.id ||
      index + 1
    ).padStart(5, '0')}`;

  const time =
    formatTime(
      sale.created_at ||
      sale.createdAt
    );

  const payment =
    getPaymentLabel(sale);

  return (
    <div className="shift-mini-sale">

      <div className="shift-mini-number">
        {orderNumber}
      </div>

      <div className="shift-mini-time">
        {time}
      </div>

      <div className="shift-mini-product">

        <strong>
          {getSaleDescription(items)}
        </strong>

        <span>
          {items.length} producto
          {items.length === 1 ? '' : 's'}
        </span>

      </div>

      <div className="shift-mini-payment">
        {payment}
      </div>

      <div className="shift-mini-total">
        {money(total)}
      </div>

    </div>
  );
}

function SaleDetailModal({
  shift,
  onClose
}) {
  const sales =
    parseSales(
      shift.sales_json ??
      shift.sales
    );

  return (
    <div
      className="shift-modal-overlay"
      onMouseDown={e => {
        if (
          e.target === e.currentTarget
        ) {
          onClose();
        }
      }}
    >

      <div className="shift-modal">

        <div className="shift-modal-header">

          <div>
            <span className="eyebrow">
              DETALLE DE JORNADA
            </span>

            <h2>
              {formatDate(
                shift.shift_date ||
                shift.date
              )}
            </h2>

            <p>
              {sales.length} ventas registradas
            </p>
          </div>

          <button
            type="button"
            className="shift-modal-close"
            onClick={onClose}
          >
            <X size={19} />
          </button>

        </div>

        <div className="shift-modal-summary">

          <div>
            <span>
              Total
            </span>

            <strong>
              {money(
                calculateTotal(
                  shift,
                  sales
                )
              )}
            </strong>
          </div>

          <div>
            <span>
              Efectivo
            </span>

            <strong>
              {money(
                calculateCash(
                  shift,
                  sales
                )
              )}
            </strong>
          </div>

          <div>
            <span>
              QR
            </span>

            <strong>
              {money(
                calculateQr(
                  shift,
                  sales
                )
              )}
            </strong>
          </div>

        </div>

        <div className="shift-modal-list">

          {sales.map(
            (sale, index) => (
              <DetailedSale
                key={
                  sale.id ||
                  sale.order_no ||
                  sale.orderNo ||
                  index
                }
                sale={sale}
                index={index}
              />
            )
          )}

        </div>

        <div className="shift-modal-footer">

          <span>
            Mostrando {sales.length} ventas
          </span>

          <button
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>

        </div>

      </div>

    </div>
  );
}

function DetailedSale({
  sale,
  index
}) {
  const items =
    parseItems(
      sale.items_json ??
      sale.items
    );

  const orderNumber =
    sale.order_no ||
    sale.orderNo ||
    `#${String(
      sale.id ||
      index + 1
    ).padStart(5, '0')}`;

  const cash =
    Number(
      sale.cash ||
      0
    );

  const change =
    Number(
      sale.change_amount ??
      sale.change ??
      0
    );

  const qr =
    Number(
      sale.qr ||
      0
    );

  return (
    <div className="shift-detail-sale">

      <div className="shift-detail-sale-top">

        <div>
          <strong>
            {orderNumber}
          </strong>

          <span>
            {formatTime(
              sale.created_at ||
              sale.createdAt
            )}
          </span>
        </div>

        <strong>
          {money(
            Number(sale.total || 0)
          )}
        </strong>

      </div>

      <div className="shift-detail-sale-items">

        {items.map(
          (item, itemIndex) => (

            <div
              className="shift-detail-item"
              key={
                item.uid ||
                item.id ||
                itemIndex
              }
            >

              <span>
                {Number(
                  item.quantity ||
                  1
                )}x
              </span>

              <div>

                <strong>
                  {item.productName ||
                   item.name ||
                   item.product ||
                   'Producto'}
                </strong>

                <small>
                  {itemDescription(item)}
                </small>

              </div>

              <b>
                {money(
                  Number(
                    item.price ||
                    0
                  )
                )}
              </b>

            </div>

          )
        )}

      </div>

      <div className="shift-detail-payment">

        {cash > 0 && (
          <span>
            Efectivo: {money(cash)}
          </span>
        )}

        {change > 0 && (
          <span>
            Vuelto: {money(change)}
          </span>
        )}

        {qr > 0 && (
          <span>
            QR: {money(qr)}
          </span>
        )}

      </div>

    </div>
  );
}

function parseSales(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function parseItems(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function calculateCash(
  shift,
  sales
) {
  if (sales.length) {
    return sales.reduce(
      (sum, sale) => {
        const cash =
          Number(
            sale.cash ||
            0
          );

        const change =
          Number(
            sale.change_amount ??
            sale.change ??
            0
          );

        return sum +
          Math.max(
            0,
            cash - change
          );
      },
      0
    );
  }

  return Number(
    shift.cash_sales ||
    shift.cash ||
    0
  );
}

function calculateQr(
  shift,
  sales
) {
  if (sales.length) {
    return sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.qr ||
          0
        ),
      0
    );
  }

  return Number(
    shift.qr_sales ||
    shift.qr ||
    0
  );
}

function calculateTotal(
  shift,
  sales
) {
  if (sales.length) {
    return sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.total ||
          0
        ),
      0
    );
  }

  return Number(
    shift.total ||
    0
  );
}

function getSaleDescription(
  items
) {
  if (!items.length) {
    return 'Venta registrada';
  }

  const first =
    items[0];

  const name =
    first.productName ||
    first.name ||
    first.product ||
    'Producto';

  if (items.length === 1) {
    return name;
  }

  return `${name} + ${items.length - 1} más`;
}

function getPaymentLabel(sale) {
  const cash =
    Number(
      sale.cash ||
      0
    );

  const change =
    Number(
      sale.change_amount ??
      sale.change ??
      0
    );

  const qr =
    Number(
      sale.qr ||
      0
    );

  const effectiveCash =
    Math.max(
      0,
      cash - change
    );

  if (
    effectiveCash > 0 &&
    qr > 0
  ) {
    return 'Mixto';
  }

  if (qr > 0) {
    return 'QR';
  }

  if (effectiveCash > 0) {
    return 'Efectivo';
  }

  return '—';
}

function formatDate(value) {
  if (!value) {
    return 'Fecha no disponible';
  }

  const parts =
    String(value)
      .slice(0, 10)
      .split('-');

  if (parts.length !== 3) {
    return value;
  }

  const [
    year,
    month,
    day
  ] = parts;

  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  if (!value) {
    return '--:--';
  }

  const text =
    String(value);

  const match =
    text.match(
      /(\d{2}):(\d{2})/
    );

  if (!match) {
    return '--:--';
  }

  return `${match[1]}:${match[2]}`;
}

function todayISO() {
  const d =
    new Date();

  const local =
    new Date(
      d.getTime() -
      d.getTimezoneOffset() *
      60000
    );

  return local
    .toISOString()
    .slice(0, 10);
}