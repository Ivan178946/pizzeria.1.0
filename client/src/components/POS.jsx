import { useEffect, useMemo, useState } from 'react';

import {
  ChefHat,
  Plus,
  Trash2,
  Receipt,
  Wallet,
  CreditCard,
  X,
  Printer,
  QrCode,
  Maximize2
} from 'lucide-react';

import Configurator, { productSizes } from './Configurator.jsx';
import PromoConfigurator from './PromoConfigurator.jsx';
import Ticket from './Ticket.jsx';
import AnimatedNumber from './AnimatedNumber.jsx';
import { itemDescription, money } from '../utils/format.js';
import { escapeHtml, printHtml } from '../utils/print.js';

export default function POS({
  menu,
  cart,
  add,
  remove,
  pay,
  setPay,
  payment = { qrEnabled: true, qrImage: '' },
  finish,
  message
}) {
  const [modal, setModal] = useState(null);
  const [promoModal, setPromoModal] = useState(null);
  const [showBeverages, setShowBeverages] = useState(false);
  const [serviceType, setServiceType] = useState('takeaway');
  const [tableNumber, setTableNumber] = useState('');
  const [printTicket, setPrintTicket] = useState(null);

  // Método de pago: efectivo, QR o mixto
  const [method, setMethod] = useState('cash');
  const [showQr, setShowQr] = useState(false);

  const qrEnabled = payment?.qrEnabled !== false;
  const qrImage = payment?.qrImage || '';

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.price || 0),
        0
      ),
    [cart]
  );

  // Si el administrador desactiva el QR se vuelve a efectivo
  useEffect(() => {
    if (!qrEnabled && method !== 'cash') {
      changeMethod('cash');
    }
  }, [qrEnabled]);

  // Pago solo por QR: el monto QR siempre es el total
  useEffect(() => {
    if (method === 'qr') {
      setPay(p => ({
        ...p,
        cash: '',
        qr: total > 0 ? String(Number(total.toFixed(2))) : ''
      }));
    }
  }, [method, total]);

  function changeMethod(next) {
    setMethod(next);

    // Al cobrar por QR se muestra el QR al medio de la pantalla
    if (next !== 'cash' && qrImage) {
      setShowQr(true);
    }

    if (next === 'cash') {
      setPay(p => ({ ...p, qr: '' }));
    }

    if (next === 'mixed') {
      setPay(p => ({ ...p, cash: '', qr: '' }));
    }
  }

  // En pago mixto, al escribir el efectivo se completa el QR
  function changeMixedCash(value) {
    const rest = Math.max(0, total - Number(value || 0));

    setPay(p => ({
      ...p,
      cash: value,
      qr: rest > 0 ? String(Number(rest.toFixed(2))) : ''
    }));
  }

  const cash = Number(pay.cash || 0);
  const qr = Number(pay.qr || 0);
  const paid = cash + qr;

  const valid =
    cart.length > 0 &&
    paid + 0.001 >= total;

  const change = Math.max(
    0,
    paid - total
  );

  const products = Array.isArray(menu?.products)
    ? menu.products
    : [];

  const flavors = Array.isArray(menu?.flavors)
    ? menu.flavors
    : [];

  const beverages = Array.isArray(menu?.beverages)
    ? menu.beverages
    : [];

  const extras = Array.isArray(menu?.extras)
    ? menu.extras
    : [];

  const promotions = Array.isArray(menu?.promotions)
    ? menu.promotions
    : [];

  /* =========================================================
     IMÁGENES
     ========================================================= */

  function getProductImage(product) {
    const name = String(
      product?.name || ''
    ).toLowerCase();

    if (
      name.includes('promo') ||
      name.includes('2 pizza') ||
      name.includes('dos pizza')
    ) {
      return '/pizados..png';
    }

    if (
      name.includes('gaseosa') ||
      name.includes('combo')
    ) {
      return '/pizagase.png';
    }

    return '/pizza uno.png';
  }

  /* =========================================================
     BEBIDAS
     ========================================================= */

  function addBeverage(beverage) {
    add({
      name: beverage.name,
      kind: 'beverage',
      size: '500 ml',
      sizeLabel: '500 ml',
      flavors: [],
      beverageName: beverage.name,
      beveragePrice: Number(
        beverage.price || 0
      ),
      extras: [],
      price: Number(
        beverage.price || 0
      )
    });

    setShowBeverages(false);
  }

  /* =========================================================
     FINALIZAR VENTA
     ========================================================= */

  async function handleFinish() {
    if (!valid) return;

    if (
      serviceType === 'table' &&
      !String(tableNumber).trim()
    ) {
      alert('Ingresa el número de mesa.');
      return;
    }

    const ticketData = {
      items: cart.map(item => ({
        ...item,
        flavors: Array.isArray(item.flavors)
          ? [...item.flavors]
          : [],
        extras: Array.isArray(item.extras)
          ? item.extras.map(e => ({ ...e }))
          : []
      })),

      serviceType,

      tableNumber:
        String(tableNumber).trim(),

      printedAt: new Date(),

      total,
      cash,
      qr,
      change
    };

    const success = await finish({
      serviceType,
      tableNumber:
        String(tableNumber).trim()
    });

    if (success !== false) {
      setPrintTicket({
        ...ticketData,
        orderCode:
          success?.orderCode ||
          success?.orderNo ||
          ''
      });
    }
  }

  /* =========================================================
     IMPRIMIR SOLAMENTE LA COMANDA
     ========================================================= */

  function printTicketNow() {
    if (!printTicket) return;

    const printedAt =
      printTicket.printedAt
        ? new Date(printTicket.printedAt)
        : new Date();

    const dateText =
      printedAt.toLocaleString(
        'es-BO',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      );

    const serviceLabel =
      printTicket.serviceType === 'table'
        ? `MESA ${printTicket.tableNumber || ''}`
        : 'PARA LLEVAR';

    const items = Array.isArray(
      printTicket.items
    )
      ? printTicket.items
      : [];

    const itemsHtml = items
      .map(item => {
        const size =
          item.sizeLabel
            ? `
              <div class="sub">
                ${escapeHtml(
                  item.sizeLabel
                )}
              </div>
            `
            : '';

        const promoPizzas =
          item.kind === 'promo' &&
          Array.isArray(item.pizzas)
            ? item.pizzas
                .map(
                  pizza => `
                    <div class="sub">
                      Pizza ${pizza.number} (${escapeHtml(pizza.size)}):
                      ${escapeHtml(pizza.flavor)}
                    </div>
                  `
                )
                .join('')
            : '';

        const promoOthers =
          item.kind === 'promo' &&
          Array.isArray(item.others) &&
          item.others.length
            ? `
              <div class="sub">
                Incluye:
                ${escapeHtml(
                  item.others
                    .map(o => `${o.qty}x ${o.name}`)
                    .join(', ')
                )}
              </div>
            `
            : '';

        const flavors =
          item.kind !== 'promo' &&
          Array.isArray(item.flavors) &&
          item.flavors.length
            ? `
              <div class="sub">
                Sabor:
                ${escapeHtml(
                  item.flavors.join(' + ')
                )}
              </div>
            `
            : '';

        const beverage =
          item.beverageName
            ? `
              <div class="sub">
                Bebida:
                ${escapeHtml(
                  item.beverageName
                )}
              </div>
            `
            : '';

        const extras =
          Array.isArray(item.extras) &&
          item.extras.length
            ? `
              <div class="sub">
                Extras:
                ${escapeHtml(
                  item.extras
                    .map(e => e.name)
                    .join(', ')
                )}
              </div>
            `
            : '';

        return `
          <div class="item">

            <div class="title">
              ${escapeHtml(
                item.name || 'Producto'
              )}
            </div>

            ${size}
            ${promoPizzas}
            ${flavors}
            ${beverage}
            ${promoOthers}
            ${extras}

          </div>
        `;
      })
      .join('');

    // Se imprime desde un iframe oculto: primero carga el
    // contenido y recién después se llama a print().
    printHtml(`
      <!DOCTYPE html>

      <html lang="es">

      <head>

        <meta charset="UTF-8">

        <title>
          Pizzería KIKIS
        </title>

        <style>

          @page {
            size: 80mm auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: 80mm;
            min-width: 80mm;
            max-width: 80mm;

            margin: 0;
            padding: 0;

            background: #ffffff;
          }

          body {
            font-family:
              "Courier New",
              Courier,
              monospace;

            color: #000000;

            overflow: visible;
          }

          .ticket {
            width: 80mm;
            max-width: 80mm;

            margin: 0;
            padding: 3mm 4mm;

            background: #ffffff;
            color: #000000;
          }

          .header {
            width: 100%;

            margin: 0;
            padding: 0;

            text-align: center;
          }

          .header-title {
            margin: 0;
            padding: 0;

            font-size: 14px;
            line-height: 16px;

            font-weight: 900;
          }

          .service {
            margin-top: 1px;

            font-size: 10px;
            line-height: 12px;

            font-weight: 900;
          }

          .order-code {
            margin-top: 2px;

            font-size: 13px;
            line-height: 15px;

            font-weight: 900;
          }

          .date {
            margin-top: 1px;

            font-size: 8px;
            line-height: 10px;
          }

          .separator {
            width: 100%;

            margin: 4px 0;

            border-top:
              1px dashed #000000;
          }

          .item {
            margin: 0 0 4px;
            padding: 0;

            page-break-inside: avoid;
            break-inside: avoid;
          }

          .title {
            margin: 0;

            font-size: 10px;
            line-height: 13px;

            font-weight: 900;

            text-transform: uppercase;
          }

          .sub {
            margin-top: 1px;

            font-size: 9px;
            line-height: 11px;

            font-weight: 700;
          }

          @media print {

            @page {
              size: 80mm auto;
              margin: 0;
            }

            html,
            body {
              width: 80mm !important;
              min-width: 80mm !important;
              max-width: 80mm !important;

              margin: 0 !important;
              padding: 0 !important;

              background: #ffffff !important;
            }

            .ticket {
              width: 80mm !important;
              max-width: 80mm !important;

              margin: 0 !important;
              padding: 3mm 4mm !important;

              background: #ffffff !important;
              color: #000000 !important;
            }

          }

        </style>

      </head>

      <body>

        <div class="ticket">

          <div class="header">

            <div class="header-title">
              PIZZERÍA KIKIS
            </div>

            ${printTicket.orderCode ? `
              <div class="order-code">
                ${escapeHtml(printTicket.orderCode)}
              </div>
            ` : ''}

            <div class="service">
              ${escapeHtml(serviceLabel)}
            </div>

            <div class="date">
              ${escapeHtml(dateText)}
            </div>

          </div>

          <div class="separator"></div>

          ${itemsHtml}

        </div>

      </body>

      </html>
    `);
  }

  /* =========================================================
     CERRAR VISTA DE COMANDA
     ========================================================= */

  function closePrintPreview() {
    setPrintTicket(null);
  }

  /* =========================================================
     INTERFAZ
     ========================================================= */

  return (
    <div className="pos">

      {/* =====================================================
          MENÚ
          ===================================================== */}

      <section className="catalog">

        <div className="section-head">

          <div>

            <span className="eyebrow">
              MENÚ
            </span>

            <h3>
              Elige una categoría
            </h3>

          </div>

          <span className="count">
            {
              products.length +
              (beverages.length ? 1 : 0)
            } opciones
          </span>

        </div>

        <div className="cards">

          {products.map((product, index) => (

            <button
              className="product-card"
              key={product.id}
              type="button"
              style={{ '--i': index }}
              onClick={() =>
                setModal(product)
              }
            >

              <div className="product-image">

                <img
                  src={getProductImage(product)}
                  alt={product.name}
                  onError={e => {
                    e.currentTarget.style.display =
                      'none';
                  }}
                />

              </div>

              <div className="pcopy">

                <b>
                  {product.name}
                </b>

                <span>
                  {product.description}
                </span>

              </div>

              <span className="price-chip">
                desde <b>{money(Math.min(...productSizes(product).map(([, price]) => price)))}</b>
              </span>

              <span className="add">
                <Plus size={17} />
              </span>

            </button>

          ))}

          {beverages.length > 0 && (

            <button
              className="product-card beverage-category"
              type="button"
              style={{ '--i': products.length }}
              onClick={() =>
                setShowBeverages(true)
              }
            >

              <div className="product-image">

                <img
                  src="/refresco.png"
                  alt="Refrescos"
                  onError={e => {
                    e.currentTarget.style.display =
                      'none';
                  }}
                />

              </div>

              <div className="pcopy">

                <b>
                  Refrescos
                </b>

                <span>
                  Elige tu gaseosa favorita
                </span>

              </div>

              <span className="price-chip">
                desde <b>{money(Math.min(...beverages.map(b => Number(b.price || 0))))}</b>
              </span>

              <span className="add">
                <Plus size={17} />
              </span>

            </button>

          )}

        </div>

        {/* ===================================================
            PROMOCIONES CREADAS POR EL ADMINISTRADOR
            =================================================== */}

        {promotions.length > 0 && (

          <div className="promo-section">

            <div className="section-head">
              <div>
                <span className="eyebrow">
                  🔥 PROMOCIONES
                </span>
                <h3>
                  Ofertas del día
                </h3>
              </div>
              <span className="count">
                {promotions.length} activa{promotions.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="promo-groups">

              {promotions.map((promo, index) => (

                <div
                  className="promo-group"
                  key={promo.id}
                  style={{ '--i': index }}
                >

                  <div className="promo-group-head">
                    {promo.image ? (
                      <img
                        className="promo-group-image"
                        src={promo.image}
                        alt=""
                      />
                    ) : (
                      <span className="promo-card-emoji">
                        {promo.emoji}
                      </span>
                    )}

                    <span className="promo-card-copy">
                      <b>{promo.title || promo.name}</b>
                      {promo.description && (
                        <em>{promo.description}</em>
                      )}
                      {promo.endDate && (
                        <small>Válida hasta el {formatShortDate(promo.endDate)}</small>
                      )}
                    </span>
                  </div>

                  <div className="promo-group-options">
                    {(promo.options || []).map(option => (
                      <button
                        key={option.id}
                        type="button"
                        className="promo-option"
                        onClick={() => setPromoModal({ promo, option })}
                        title={option.summary}
                      >
                        <span className="promo-option-copy">
                          <b>{option.name}</b>
                          <small>{option.summary}</small>
                        </span>

                        <span className="promo-option-price">
                          {option.savings > 0 && (
                            <s>{money(option.normalPrice)}</s>
                          )}
                          <strong>{money(option.promoPrice)}</strong>
                        </span>

                        <span className="promo-option-add">
                          <Plus size={15} />
                        </span>
                      </button>
                    ))}
                  </div>

                </div>

              ))}

            </div>

          </div>

        )}

        <div className="flavor-panel">

          <span className="eyebrow">
            SABORES DISPONIBLES
          </span>

          <div className="pills">

            {flavors.map((flavor, index) => (

              <span key={flavor.id} style={{ '--i': index }}>
                {flavor.name}
              </span>

            ))}

          </div>

        </div>

      </section>

      {/* =====================================================
          COMANDA
          ===================================================== */}

      <section className="ticket">

        <div className="ticket-head">

          <div>

            <span className="eyebrow">
              PEDIDO ACTUAL
            </span>

            <h3>
              Comanda
            </h3>

          </div>

          <span className="ticket-no" key={cart.length}>

            {cart.length
              ? `${cart.length} ITEM${
                  cart.length === 1
                    ? ''
                    : 'S'
                }`
              : 'NUEVO'}

          </span>

        </div>

        <div className="ticket-items">

          {!cart.length ? (

            <div className="empty">

              <ChefHat size={32} />

              <b>
                Tu pedido está vacío
              </b>

              <span>
                Selecciona una opción
                para comenzar
              </span>

            </div>

          ) : (

            cart.map(item => (

              <div
                className="line"
                key={item.uid}
              >

                <div className="line-icon">
                  {
                    item.kind === 'beverage'
                      ? '🥤'
                      : item.kind === 'promo'
                        ? item.emoji || '🎉'
                        : '🍕'
                  }
                </div>

                <div className="line-copy">

                  <b>
                    {item.name}
                  </b>

                  <span>
                    {itemDescription(item)}
                  </span>

                </div>

                <strong>
                  {money(item.price)}
                </strong>

                <button
                  className="icon-btn"
                  type="button"
                  onClick={() =>
                    remove(item.uid)
                  }
                  title="Quitar"
                >

                  <Trash2 size={15} />

                </button>

              </div>

            ))

          )}

        </div>

        {/* ===================================================
            TIPO DE PEDIDO
            =================================================== */}

        <div className="order-type">

          <span className="eyebrow">
            TIPO DE PEDIDO
          </span>

          <div className="order-type-buttons">

            <button
              type="button"
              className={
                serviceType === 'takeaway'
                  ? 'order-type-btn active'
                  : 'order-type-btn'
              }
              onClick={() => {

                setServiceType(
                  'takeaway'
                );

                setTableNumber('');

              }}
            >
              🛍️ Para llevar
            </button>

            <button
              type="button"
              className={
                serviceType === 'table'
                  ? 'order-type-btn active'
                  : 'order-type-btn'
              }
              onClick={() =>
                setServiceType('table')
              }
            >
              🍽️ Mesa
            </button>

          </div>

          {serviceType === 'table' && (

            <input
              className="table-input"
              type="number"
              min="1"
              placeholder="Número de mesa"
              value={tableNumber}
              onChange={e =>
                setTableNumber(
                  e.target.value
                )
              }
            />

          )}

        </div>

        {/* ===================================================
            PAGO
            =================================================== */}

        <div className="checkout">

          <div className="tot">

            <span>
              Total
            </span>

            <b>
              <AnimatedNumber
                value={total}
                format={money}
                duration={450}
              />
            </b>

          </div>

          {/* Método de pago */}

          <div className="pay-methods segmented">
            {[
              ['cash', 'Efectivo', Wallet],
              ['qr', 'QR', QrCode],
              ['mixed', 'Mixto', CreditCard]
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                className={method === id ? 'active' : ''}
                disabled={id !== 'cash' && !qrEnabled}
                title={id !== 'cash' && !qrEnabled ? 'El administrador desactivó el pago por QR' : ''}
                onClick={() => changeMethod(id)}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className={method === 'mixed' ? 'pay-grid' : 'pay-grid single'}>

            {method !== 'qr' && (
              <label className="pay-cash">

                <span>

                  <Wallet size={15} />

                  Efectivo

                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pay.cash}
                  onChange={e =>
                    method === 'mixed'
                      ? changeMixedCash(e.target.value)
                      : setPay(p => ({
                          ...p,
                          cash: e.target.value
                        }))
                  }
                />

              </label>
            )}

            {method !== 'cash' && (
              <label className="pay-qr">

                <span>

                  <CreditCard size={15} />

                  QR

                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pay.qr}
                  onChange={e =>
                    setPay(p => ({
                      ...p,
                      qr: e.target.value
                    }))
                  }
                />

              </label>
            )}

          </div>

          {/* QR cargado por el administrador */}

          {method !== 'cash' && (
            qrImage ? (
              <button
                type="button"
                className="pos-qr"
                onClick={() => setShowQr(true)}
                title="Mostrar el QR en grande al cliente"
              >
                <img src={qrImage} alt="QR de pago" />
                <span>
                  <b>Escanea para pagar</b>
                  <small>{money(qr)} por QR</small>
                  <em><Maximize2 size={12} /> Ver en grande</em>
                </span>
              </button>
            ) : (
              <div className="pos-qr empty">
                <QrCode size={22} />
                <span>
                  <b>Sin QR cargado</b>
                  <small>El administrador puede subirlo en Administración → Pago por QR.</small>
                </span>
              </div>
            )
          )}

          <div className="change">

            <span>
              Vuelto
            </span>

            <b>
              <AnimatedNumber
                value={change}
                format={money}
                duration={350}
              />
            </b>

          </div>

          <div
            className={
              !cart.length
                ? 'payment-idle'
                : valid
                  ? 'payment-ok'
                  : 'payment-bad'
            }
          >

            {!cart.length
              ? 'Agrega productos para cobrar'
              : valid
              ? '✓ Pago correcto'
              : `Falta ${money(
                  Math.max(
                    0,
                    total - paid
                  )
                )} para completar`}

          </div>

          <button
            className="primary full big"
            type="button"
            disabled={!valid}
            onClick={handleFinish}
          >

            <Receipt size={18} />

            Confirmar y registrar venta

          </button>

          {message && (

            <div
              className={
                message.startsWith('✓')
                  ? 'toast success'
                  : 'toast error'
              }
              key={message}
            >
              {message}
            </div>

          )}

        </div>

      </section>

      {/* =====================================================
          CONFIGURADOR
          ===================================================== */}

      {modal && (

        <Configurator
          product={modal}
          flavors={flavors}
          extras={extras}
          onClose={() =>
            setModal(null)
          }
          onAdd={item => {

            add(item);
            setModal(null);

          }}
        />

      )}

      {/* =====================================================
          CONFIGURADOR DE PROMOCIÓN
          ===================================================== */}

      {promoModal && (

        <PromoConfigurator
          promo={promoModal.promo}
          option={promoModal.option}
          flavors={flavors}
          beverages={beverages}
          onClose={() =>
            setPromoModal(null)
          }
          onAdd={item => {

            add(item);
            setPromoModal(null);

          }}
        />

      )}

      {/* =====================================================
          BEBIDAS
          ===================================================== */}

      {showBeverages && (

        <div className="modal-backdrop">

          <div className="modal beverages-modal">

            <button
              className="modal-close"
              type="button"
              onClick={() =>
                setShowBeverages(false)
              }
            >
              <X size={22} />
            </button>

            <span className="eyebrow">
              BEBIDAS
            </span>

            <h2>
              Variedad de refrescos
            </h2>

            <p>
              Selecciona el refresco
              que deseas agregar
              al pedido.
            </p>

            <div className="beverages-grid">

              {beverages.map(
                beverage => (

                  <button
                    className="beverage-option"
                    type="button"
                    key={beverage.id}
                    onClick={() =>
                      addBeverage(
                        beverage
                      )
                    }
                  >

                    <div className="beverage-icon">
                      🥤
                    </div>

                    <div className="beverage-info">

                      <b>
                        {beverage.name}
                      </b>

                      <span>
                        Refresco
                      </span>

                    </div>

                    <strong>
                      {money(
                        beverage.price
                      )}
                    </strong>

                    <span className="beverage-add">

                      <Plus size={17} />

                    </span>

                  </button>

                )
              )}

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          QR EN GRANDE PARA EL CLIENTE
          ===================================================== */}

      {showQr && qrImage && (

        <div
          className="modal-backdrop"
          onMouseDown={e => e.target === e.currentTarget && setShowQr(false)}
        >

          <div className="modal qr-modal">

            <button
              className="modal-close"
              type="button"
              onClick={() => setShowQr(false)}
            >
              <X size={22} />
            </button>

            <span className="eyebrow">
              PAGO POR QR
            </span>

            <h2>
              {money(qr)}
            </h2>

            <img src={qrImage} alt="QR de pago" />

            <p>
              Escanea el código con la app de tu banco.
            </p>

            <button
              className="primary full big"
              type="button"
              onClick={() => setShowQr(false)}
            >
              Listo
            </button>

          </div>

        </div>

      )}

      {/* =====================================================
          VISTA PREVIA DE COMANDA
          ===================================================== */}

      {printTicket && (

        <div className="modal-backdrop print-preview-backdrop">

          <div className="print-preview">

            <button
              className="modal-close"
              type="button"
              onClick={
                closePrintPreview
              }
            >
              <X size={22} />
            </button>

            <div className="print-preview-title">

              <span className="eyebrow">
                VENTA REGISTRADA
              </span>

              <h2>
                Comanda lista
              </h2>

              <p>
                Revisa el pedido
                y presiona imprimir.
              </p>

            </div>

            <div className="ticket-preview-container print-ticket-area">

              <Ticket
                orderCode={printTicket.orderCode}
                items={printTicket.items}
                serviceType={
                  printTicket.serviceType
                }
                tableNumber={
                  printTicket.tableNumber
                }
                printedAt={
                  printTicket.printedAt
                }
              />

            </div>

            <div className="print-actions">

              <button
                className="primary print-button"
                type="button"
                onClick={
                  printTicketNow
                }
              >

                <Printer size={18} />

                IMPRIMIR COMANDA

              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={
                  closePrintPreview
                }
              >
                Cerrar
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}


/* =========================================================
   FECHA CORTA: 2026-10-31 → 31/10/2026
   ========================================================= */

function formatShortDate(value) {
  const [y, m, d] = String(value).split('-');
  return d && m ? `${d}/${m}/${y}` : value;
}
