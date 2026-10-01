/* =========================================================
   SERVICIO DE VALIDACIÓN DE PEDIDOS
========================================================= */

import { db } from '../db.js';
import { validatePromoItem } from './promotionService.js';
import { findProduct } from './productService.js';


/* =========================================================
   NORMALIZAR TEXTO
========================================================= */

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}


/* =========================================================
   VALIDAR PRECIOS CONTRA LA BASE DE DATOS
========================================================= */

const priceChanged = name =>
  new Error(`El precio de "${name}" cambió. Quítalo de la comanda y vuelve a agregarlo.`);

const sameMoney = (a, b) =>
  Math.abs(Number(a) - Number(b)) < 0.001;

function validateProductPrice(item) {
  if (item.productId === undefined || item.productId === null) {
    throw new Error(`"${item.name || 'Un producto'}" se agregó con una versión anterior del sistema. Quítalo y vuelve a agregarlo.`);
  }

  const product = findProduct(Number(item.productId));

  if (!product || !product.active) {
    throw new Error(`"${item.name || 'El producto'}" ya no está disponible`);
  }

  const size = product.sizes.find(s => s.name === item.size);

  if (!size) {
    throw new Error(`El tamaño "${item.size}" de "${product.name}" ya no existe. Vuelve a agregarlo.`);
  }

  if (!sameMoney(item.basePrice, size.price)) {
    throw priceChanged(product.name);
  }

  const extras = Array.isArray(item.extras) ? item.extras : [];
  const getExtra = db.prepare('SELECT price FROM extras WHERE id = ?');

  for (const extra of extras) {
    const current = extra?.id !== undefined ? getExtra.get(Number(extra.id)) : null;

    if (current && !sameMoney(current.price, extra.price)) {
      throw priceChanged(extra.name || 'un ingrediente extra');
    }
  }

  const extrasTotal = extras.reduce((sum, e) => sum + Number(e?.price || 0), 0);

  if (!sameMoney(item.price, size.price + extrasTotal)) {
    throw priceChanged(product.name);
  }
}

function validateBeveragePrice(item) {
  const beverage = db.prepare(`
    SELECT *
    FROM beverages
    WHERE name = ?
  `).get(String(item.beverageName || item.name || ''));

  if (!beverage || !beverage.active) {
    throw new Error(`"${item.name || 'El refresco'}" ya no está disponible`);
  }

  if (!sameMoney(item.price, beverage.price)) {
    throw priceChanged(beverage.name);
  }
}


/* =========================================================
   VALIDAR PRODUCTOS
========================================================= */

export function validateItems(items) {

  /* -------------------------------------------------------
     VALIDAR COMANDA
  ------------------------------------------------------- */

  if (!Array.isArray(items)) {
    throw new Error(
      'El pedido no contiene productos válidos'
    );
  }


  if (items.length === 0) {
    throw new Error(
      'La comanda está vacía'
    );
  }


  /* -------------------------------------------------------
     REVISAR CADA PRODUCTO
  ------------------------------------------------------- */

  items.forEach((item, index) => {

    if (!item || typeof item !== 'object') {
      throw new Error(
        `Producto inválido en la posición ${index + 1}`
      );
    }


    const kind = String(
      item.kind || ''
    );


    /* =====================================================
       PRECIO
    ===================================================== */

    const price = Number(
      item.price
    );


    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error(
        `Precio inválido en el producto ${index + 1}`
      );
    }


    /* =====================================================
       PRECIO VIGENTE
       El precio se compara con el que fijó el administrador,
       así una comanda armada antes de un cambio de precios
       no se cobra con el precio viejo.
    ===================================================== */

    if (['individual', 'double', 'combo'].includes(kind)) {
      validateProductPrice(item);
    }

    if (kind === 'beverage') {
      validateBeveragePrice(item);
    }


    /* =====================================================
       SABORES
    ===================================================== */

    if (!Array.isArray(item.flavors)) {
      throw new Error(
        `El producto "${item.name || 'producto'}" no tiene sabores válidos`
      );
    }


    /* =====================================================
       PIZZA INDIVIDUAL
       
       Permite:
       - 1 sabor
       - 2 sabores
    ===================================================== */

    if (kind === 'individual') {

      if (
        item.flavors.length < 1 ||
        item.flavors.length > 2
      ) {
        throw new Error(
          'La pizza individual debe tener uno o dos sabores'
        );
      }

    }


    /* =====================================================
       PROMO 2 PIZZAS

       Ambas pizzas del mismo tamaño; los tamaños
       permitidos los define el administrador.
    ===================================================== */

    if (kind === 'double') {

      const selectedSize =
        normalizeText(
          item.size ||
          item.sizeLabel ||
          ''
        );


      /* ---------------------------------------------------
         VALIDAR TAMAÑO
      --------------------------------------------------- */

      // El tamaño ya se validó contra la base de datos en
      // validateProductPrice (el administrador define los tamaños).


      /* ---------------------------------------------------
         EXACTAMENTE 2 SABORES
      --------------------------------------------------- */

      if (
        item.flavors.length !== 2 ||
        !item.flavors[0] ||
        !item.flavors[1]
      ) {

        throw new Error(
          'La promo de 2 pizzas requiere exactamente dos sabores'
        );

      }


      /* ---------------------------------------------------
         VALIDAR LAS DOS PIZZAS
      --------------------------------------------------- */

      if (
        Array.isArray(item.pizzas) &&
        item.pizzas.length === 2
      ) {

        const pizza1 =
          item.pizzas[0];

        const pizza2 =
          item.pizzas[1];


        /* -----------------------------------------------
           PIZZA 1
        ------------------------------------------------ */

        if (
          !pizza1 ||
          !pizza1.flavor
        ) {

          throw new Error(
            'La Pizza 1 necesita un sabor'
          );

        }


        /* -----------------------------------------------
           PIZZA 2
        ------------------------------------------------ */

        if (
          !pizza2 ||
          !pizza2.flavor
        ) {

          throw new Error(
            'La Pizza 2 necesita un sabor'
          );

        }


        /* -----------------------------------------------
           AMBAS DEBEN TENER EL MISMO TAMAÑO
        ------------------------------------------------ */

        const sizePizza1 =
          normalizeText(
            pizza1.size ||
            pizza1.sizeLabel ||
            ''
          );


        const sizePizza2 =
          normalizeText(
            pizza2.size ||
            pizza2.sizeLabel ||
            ''
          );


        if (
          sizePizza1 !== selectedSize ||
          sizePizza2 !== selectedSize
        ) {

          throw new Error(
            'Las dos pizzas de la promo deben tener el mismo tamaño'
          );

        }

      }

    }


    /* =====================================================
       PIZZA + GASEOSA
       
       Debe tener:
       - exactamente 1 sabor
       - gaseosa incluida
       - gaseosa gratis
    ===================================================== */

    if (kind === 'combo') {

      if (
        item.flavors.length !== 1 ||
        !item.flavors[0]
      ) {

        throw new Error(
          'Pizza + gaseosa requiere exactamente un sabor'
        );

      }


      /* ---------------------------------------------------
         GASEOSA INCLUIDA
      --------------------------------------------------- */

      if (
        item.beveragePrice !== undefined &&
        Number(item.beveragePrice) !== 0
      ) {

        throw new Error(
          'La gaseosa incluida no puede tener costo adicional'
        );

      }

    }


    /* =====================================================
       PROMOCIÓN CREADA POR EL ADMINISTRADOR
    ===================================================== */

    if (kind === 'promo') {

      validatePromoItem(item);

    }


    /* =====================================================
       EXTRAS
    ===================================================== */

    if (
      item.extras !== undefined &&
      !Array.isArray(item.extras)
    ) {

      throw new Error(
        `Los extras del producto "${item.name || 'producto'}" no son válidos`
      );

    }


    if (
      Array.isArray(item.extras)
    ) {

      item.extras.forEach(extra => {

        if (
          !extra ||
          !Number.isFinite(
            Number(extra.price)
          ) ||
          Number(extra.price) < 0
        ) {

          throw new Error(
            'Uno de los ingredientes extra tiene un precio inválido'
          );

        }

      });

    }

  });


  return true;
}


/* =========================================================
   VALIDAR PAGO
========================================================= */

export function validatePayment(
  total,
  cash = 0,
  qr = 0
) {

  /* -------------------------------------------------------
     CONVERTIR A NÚMEROS
  ------------------------------------------------------- */

  const totalNumber =
    Number(total || 0);

  const cashNumber =
    Number(cash || 0);

  const qrNumber =
    Number(qr || 0);


  /* =====================================================
     VALIDAR TOTAL
  ===================================================== */

  if (
    !Number.isFinite(totalNumber) ||
    totalNumber < 0
  ) {

    throw new Error(
      'El total de la venta no es válido'
    );

  }


  /* =====================================================
     VALIDAR EFECTIVO
  ===================================================== */

  if (
    !Number.isFinite(cashNumber) ||
    cashNumber < 0
  ) {

    throw new Error(
      'El monto en efectivo no es válido'
    );

  }


  /* =====================================================
     VALIDAR QR
  ===================================================== */

  if (
    !Number.isFinite(qrNumber) ||
    qrNumber < 0
  ) {

    throw new Error(
      'El monto QR no es válido'
    );

  }


  /* =====================================================
     TOTAL PAGADO
  ===================================================== */

  const paid =
    cashNumber + qrNumber;


  /* =====================================================
     VERIFICAR PAGO
  ===================================================== */

  if (
    paid + 0.001 <
    totalNumber
  ) {

    throw new Error(
      `Falta Bs ${(totalNumber - paid).toFixed(2)} para completar el pago`
    );

  }


  /* =====================================================
     CALCULAR VUELTO
     
     Ejemplo:
     
     Total = Bs 149
     Efectivo = Bs 150
     
     Vuelto = Bs 1
  ===================================================== */

  const change =
    Math.max(
      0,
      cashNumber - totalNumber
    );


  /* =====================================================
     RESULTADO
  ===================================================== */

  return {

    total:
      Number(
        totalNumber.toFixed(2)
      ),

    cash:
      Number(
        cashNumber.toFixed(2)
      ),

    qr:
      Number(
        qrNumber.toFixed(2)
      ),

    change:
      Number(
        change.toFixed(2)
      )

  };

}