// =========================================================
// IMPRESIÓN DE TICKETS
// Se imprime desde un iframe oculto (no una ventana
// about:blank): primero se escribe el ticket, se espera a
// que cargue el logo y recién después se llama a print().
// Así nunca sale una página vacía ni se imprime toda la
// pantalla del sistema.
// =========================================================

import {
  itemDetailLines,
  money,
  orderCode,
  orderPaymentMethod,
  parseOrderDate,
  paymentMethodLabel
} from './format.js';

const WIDTH_KEY = 'kikis.ticketWidth';

export function getTicketWidth() {
  try {
    return localStorage.getItem(WIDTH_KEY) === '58' ? 58 : 80;
  } catch {
    return 80;
  }
}

export function setTicketWidth(width) {
  try {
    localStorage.setItem(WIDTH_KEY, String(width));
  } catch {
    // sin almacenamiento: se usa 80 mm
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// =========================================================
// IMPRIMIR UN DOCUMENTO HTML COMPLETO
// =========================================================

export function printHtml(html) {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');

    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'position:fixed;left:-10000px;top:0;width:420px;height:800px;border:0;opacity:0;pointer-events:none;';

    document.body.appendChild(frame);

    const win = frame.contentWindow;
    const doc = win.document;

    let done = false;

    function cleanup() {
      if (done) return;
      done = true;
      setTimeout(() => {
        frame.remove();
        resolve();
      }, 300);
    }

    doc.open();
    doc.write(html);
    doc.close();

    async function run() {
      // Esperar imágenes (logo) antes de imprimir
      const images = Array.from(doc.images || []);

      await Promise.all(
        images.map(img =>
          img.complete
            ? null
            : new Promise(done => {
                img.onload = done;
                img.onerror = done;
                setTimeout(done, 2500);
              })
        )
      );

      // Un cuadro de animación para que el navegador termine
      // de dibujar el ticket.
      await new Promise(r => requestAnimationFrame(() => r()));

      win.addEventListener('afterprint', cleanup);
      win.focus();
      win.print();

      // Respaldo por si el navegador no emite "afterprint"
      setTimeout(cleanup, 60000);
    }

    if (doc.readyState === 'complete') {
      run();
    } else {
      frame.addEventListener('load', run, { once: true });
    }
  });
}


// =========================================================
// ESTILOS BASE PARA IMPRESORA TÉRMICA (80 mm / 58 mm)
// =========================================================

export function thermalStyles(width = 80) {
  const narrow = width === 58;
  const content = narrow ? 48 : 72;

  return `
    @page { size: ${width}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      width: ${width}mm;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
    }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: ${narrow ? 10 : 11.5}px;
      line-height: 1.3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ticket {
      width: ${content}mm;
      margin: 0 auto;
      padding: 3mm 0 6mm;
    }
    .center { text-align: center; }
    .logo {
      display: block;
      width: ${narrow ? 16 : 20}mm;
      height: ${narrow ? 16 : 20}mm;
      margin: 0 auto 2px;
      object-fit: cover;
      border-radius: 50%;
      filter: grayscale(1);
    }
    .brand {
      font-size: ${narrow ? 13 : 15}px;
      font-weight: 900;
      letter-spacing: .5px;
    }
    .code {
      margin-top: 3px;
      font-size: ${narrow ? 13 : 15}px;
      font-weight: 900;
    }
    .muted { font-size: ${narrow ? 9 : 10}px; }
    .sep { border-top: 1px dashed #000; margin: 5px 0; }
    .sep.solid { border-top-style: solid; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }
    .row > span:last-child { white-space: nowrap; text-align: right; }
    .bold { font-weight: 900; }
    .item { margin-bottom: 4px; break-inside: avoid; page-break-inside: avoid; }
    .item-name { font-weight: 900; text-transform: uppercase; }
    .item-sub {
      padding-left: 8px;
      font-size: ${narrow ? 9 : 10}px;
    }
    .total {
      font-size: ${narrow ? 13 : 15}px;
      font-weight: 900;
    }
    .thanks {
      margin-top: 8px;
      font-weight: 900;
      text-align: center;
    }
  `;
}


// =========================================================
// TICKET DE VENTA (con precios) — "Ventas de hoy"
// =========================================================

export function buildReceiptHtml(order, { width = getTicketWidth(), items = [] } = {}) {
  const date = parseOrderDate(order.created_at ?? order.createdAt) || new Date();

  const dateText = date.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const timeText = date.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const total = Number(order.total || 0);
  const cash = Number(order.cash || 0);
  const qr = Number(order.qr || 0);
  const change = Number(order.change_amount ?? order.change ?? 0);
  const method = orderPaymentMethod(order);

  const itemsHtml = items.map(item => {
    const qty = Number(item.quantity || 1);
    const subtotal = Number(item.price || 0);
    const unit = qty ? subtotal / qty : subtotal;

    const lines = itemDetailLines(item)
      .map(line => `<div class="item-sub">${escapeHtml(line)}</div>`)
      .join('');

    return `
      <div class="item">
        <div class="item-name">${escapeHtml(item.name || 'Producto')}</div>
        ${lines}
        <div class="row">
          <span>${qty} x ${escapeHtml(money(unit))}</span>
          <span class="bold">${escapeHtml(money(subtotal))}</span>
        </div>
      </div>
    `;
  }).join('');

  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0), 0);

  const paymentRows = [
    cash > 0 ? `<div class="row"><span>Efectivo</span><span>${escapeHtml(money(cash))}</span></div>` : '',
    qr > 0 ? `<div class="row"><span>QR</span><span>${escapeHtml(money(qr))}</span></div>` : '',
    change > 0 ? `<div class="row bold"><span>Cambio</span><span>${escapeHtml(money(change))}</span></div>` : ''
  ].join('');

  const logo = `${window.location.origin}/logo.jpeg`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(orderCode(order))}</title>
  <style>${thermalStyles(width)}</style>
</head>
<body>
  <div class="ticket">
    <div class="center">
      <img class="logo" src="${escapeHtml(logo)}" alt="" onerror="this.remove()">
      <div class="brand">PIZZERÍA KIKIS</div>
      <div class="code">${escapeHtml(orderCode(order))}</div>
      <div class="muted">Fecha: ${escapeHtml(dateText)} &nbsp; Hora: ${escapeHtml(timeText)}</div>
    </div>

    <div class="sep"></div>

    ${itemsHtml || '<div class="center">Sin productos</div>'}

    <div class="sep"></div>

    <div class="row"><span>Subtotal</span><span>${escapeHtml(money(subtotal))}</span></div>
    <div class="row total"><span>TOTAL</span><span>${escapeHtml(money(total))}</span></div>

    <div class="sep"></div>

    <div class="row"><span>Método de pago</span><span class="bold">${escapeHtml(paymentMethodLabel(method))}</span></div>
    ${paymentRows}

    <div class="sep solid"></div>

    <div class="thanks">¡Gracias por su compra!</div>
  </div>
</body>
</html>`;
}

export function printReceipt(order, items, width) {
  return printHtml(buildReceiptHtml(order, { items, width }));
}
