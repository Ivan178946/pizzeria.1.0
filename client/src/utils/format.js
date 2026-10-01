export const money = value => `Bs ${Number(value || 0).toFixed(2)}`;

export const todayISO = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

// "2× Pizza Mediana + 1× Refresco + 1× Papas fritas"
export function promoSummary(components = []) {
  return components
    .map(c => {
      if (c.type === 'pizza') return `${c.qty}× Pizza ${c.size}`;
      if (c.type === 'beverage') return `${c.qty}× Refresco`;
      return `${c.qty}× ${c.name}`;
    })
    .join(' + ');
}

export function itemDescription(item) {
  const parts = [];
  if (item.sizeLabel) parts.push(item.sizeLabel);
  if (item.flavors?.length) parts.push(item.flavors.join(' + '));
  if (item.beverageName) parts.push(item.beverageName);
  return parts.join(' • ');
}

// Detalle línea por línea de un producto vendido
// (para el detalle de la venta y el ticket impreso).
export function itemDetailLines(item = {}) {
  const lines = [];
  const pizzas = Array.isArray(item.pizzas) ? item.pizzas : [];
  const extras = Array.isArray(item.extras) ? item.extras : [];

  if (item.kind === 'promo') {
    if (item.optionSummary || item.sizeLabel) {
      lines.push(item.optionSummary || item.sizeLabel);
    }

    pizzas.forEach(p => {
      lines.push(`Pizza ${p.number} (${p.sizeLabel || p.size}): ${p.flavor}`);
    });

    (Array.isArray(item.beverages) ? item.beverages : []).forEach(b => {
      lines.push(`Refresco: ${b}`);
    });

    (Array.isArray(item.others) ? item.others : []).forEach(o => {
      lines.push(`${o.qty}x ${o.name}`);
    });

    return lines;
  }

  if (item.kind === 'beverage') {
    if (item.sizeLabel) lines.push(item.sizeLabel);
    return lines;
  }

  if (item.sizeLabel || item.size) {
    lines.push(item.sizeLabel || item.size);
  }

  if (item.kind === 'double' && pizzas.length) {
    pizzas.forEach(p => {
      const ex = (p.extras || []).map(e => e.name).filter(Boolean).join(', ');
      lines.push(`Pizza ${p.number}: ${p.flavor}${ex ? ` + ${ex}` : ''}`);
    });
  } else {
    if (item.flavors?.length) {
      lines.push(`Sabor: ${item.flavors.join(' / ')}`);
    }

    if (extras.length) {
      lines.push(`Extras: ${extras.map(e => e.name).filter(Boolean).join(', ')}`);
    }
  }

  if (item.kind === 'combo') {
    lines.push('Gaseosa incluida');
  }

  return lines;
}


// =========================================================
// VENTAS
// =========================================================

// Las ventas guardan la hora local como "YYYY-MM-DD HH:MM:SS"
export function parseOrderDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);

  const date = match
    ? new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6] || 0)
      )
    : new Date(text);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function orderCode(order = {}) {
  return (
    order.order_code ||
    order.orderCode ||
    order.order_no ||
    order.orderNo ||
    `#${String(order.id || '').padStart(5, '0')}`
  );
}

export function orderPaymentMethod(order = {}) {
  const method = order.payment_method || order.paymentMethod;

  if (method) return method;

  const cash = Number(order.cash || 0);
  const qr = Number(order.qr || 0);

  if (cash > 0 && qr > 0) return 'mixed';
  if (qr > 0) return 'qr';
  return 'cash';
}

export function paymentMethodLabel(method) {
  return {
    cash: 'Efectivo',
    qr: 'QR',
    mixed: 'Mixto (Efectivo + QR)'
  }[method] || 'Efectivo';
}

// Cantidad total de productos de una venta
export function itemsCount(items = []) {
  return items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
}
