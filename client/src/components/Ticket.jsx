import React from 'react';

/* =========================================================
   FORMATEAR EXTRAS
========================================================= */

function extrasText(extras = []) {
  if (!Array.isArray(extras) || extras.length === 0) {
    return '';
  }

  return extras
    .map(extra => extra?.name)
    .filter(Boolean)
    .join(', ');
}


/* =========================================================
   FECHA Y HORA
========================================================= */

function getDateTime(value) {
  const dateObject = value
    ? new Date(value)
    : new Date();

  const date = dateObject.toLocaleDateString(
    'es-BO',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }
  );

  const time = dateObject.toLocaleTimeString(
    'es-BO',
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
  );

  return {
    date,
    time
  };
}


/* =========================================================
   FORMATEAR PRODUCTO
========================================================= */

function formatItem(item) {

  const lines = [];


  /* =======================================================
     REFRESCO COMPRADO APARTE
  ======================================================= */

  if (item.kind === 'beverage') {

    lines.push({
      type: 'title',
      text: 'REFRESCO'
    });

    lines.push({
      type: 'text',
      text:
        item.beverageName ||
        item.name ||
        'Refresco'
    });

    if (item.sizeLabel) {
      lines.push({
        type: 'text',
        text: item.sizeLabel
      });
    }

    return lines;
  }


  /* =======================================================
     PROMO 2 PIZZAS
  ======================================================= */

  if (item.kind === 'double') {

    lines.push({
      type: 'title',
      text: 'PROMO 2 PIZZAS'
    });


    const pizzas =
      Array.isArray(item.pizzas)
        ? item.pizzas
        : [];


    /* -----------------------------------------------------
       TAMAÑO
    ----------------------------------------------------- */

    const size =
      pizzas[0]?.sizeLabel ||
      pizzas[0]?.size ||
      item.sizeLabel ||
      item.size ||
      '';

    if (size) {

      lines.push({
        type: 'text',
        text: size
      });

    }


    /* -----------------------------------------------------
       PIZZA 1
    ----------------------------------------------------- */

    if (pizzas[0]) {

      lines.push({
        type: 'subtitle',
        text: 'PIZZA 1'
      });


      if (pizzas[0].flavor) {

        lines.push({
          type: 'text',
          text:
            `Sabor: ${pizzas[0].flavor}`
        });

      }


      const extra1 =
        extrasText(
          pizzas[0].extras
        );

      if (extra1) {

        lines.push({
          type: 'text',
          text:
            `Extra: ${extra1}`
        });

      }

    }


    /* -----------------------------------------------------
       PIZZA 2
    ----------------------------------------------------- */

    if (pizzas[1]) {

      lines.push({
        type: 'subtitle',
        text: 'PIZZA 2'
      });


      if (pizzas[1].flavor) {

        lines.push({
          type: 'text',
          text:
            `Sabor: ${pizzas[1].flavor}`
        });

      }


      const extra2 =
        extrasText(
          pizzas[1].extras
        );

      if (extra2) {

        lines.push({
          type: 'text',
          text:
            `Extra: ${extra2}`
        });

      }

    }


    /* =====================================================
       COMPATIBILIDAD CON PEDIDOS ANTIGUOS
    ===================================================== */

    if (pizzas.length === 0) {

      const flavors =
        Array.isArray(item.flavors)
          ? item.flavors
          : [];


      if (flavors[0]) {

        lines.push({
          type: 'subtitle',
          text: 'PIZZA 1'
        });

        lines.push({
          type: 'text',
          text:
            `Sabor: ${flavors[0]}`
        });

      }


      if (flavors[1]) {

        lines.push({
          type: 'subtitle',
          text: 'PIZZA 2'
        });

        lines.push({
          type: 'text',
          text:
            `Sabor: ${flavors[1]}`
        });

      }


      const extra =
        extrasText(item.extras);

      if (extra) {

        lines.push({
          type: 'text',
          text:
            `Extra: ${extra}`
        });

      }

    }


    return lines;
  }


  /* =======================================================
     PROMOCIÓN CREADA POR EL ADMINISTRADOR
  ======================================================= */

  if (item.kind === 'promo') {

    lines.push({
      type: 'title',
      text: `PROMO: ${String(item.name || '').toUpperCase()}`
    });

    (Array.isArray(item.pizzas) ? item.pizzas : []).forEach(pizza => {
      lines.push({
        type: 'text',
        text: `Pizza ${pizza.number} (${pizza.size}): ${pizza.flavor}`
      });
    });

    (Array.isArray(item.beverages) ? item.beverages : []).forEach(drink => {
      lines.push({
        type: 'text',
        text: `Refresco: ${drink}`
      });
    });

    (Array.isArray(item.others) ? item.others : []).forEach(other => {
      lines.push({
        type: 'text',
        text: `${other.qty}x ${other.name}`
      });
    });

    return lines;
  }


  /* =======================================================
     PIZZA + GASEOSA
  ======================================================= */

  if (item.kind === 'combo') {

    lines.push({
      type: 'title',
      text: 'PIZZA + GASEOSA'
    });


    const size =
      item.sizeLabel ||
      item.size ||
      '';

    if (size) {

      lines.push({
        type: 'text',
        text: size
      });

    }


    const flavors =
      Array.isArray(item.flavors)
        ? item.flavors
        : [];


    if (flavors.length === 1) {

      lines.push({
        type: 'text',
        text:
          `Sabor: ${flavors[0]}`
      });

    }


    if (flavors.length >= 2) {

      lines.push({
        type: 'text',
        text:
          `Sabores: ${flavors.join(' / ')}`
      });

    }


    const extra =
      extrasText(item.extras);

    if (extra) {

      lines.push({
        type: 'text',
        text:
          `Extra: ${extra}`
      });

    }


    lines.push({
      type: 'text',
      text: 'Gaseosa: INCLUIDA'
    });


    return lines;
  }


  /* =======================================================
     PIZZA INDIVIDUAL
  ======================================================= */

  lines.push({
    type: 'title',
    text: 'PIZZA INDIVIDUAL'
  });


  /* -------------------------------------------------------
     TAMAÑO
  ------------------------------------------------------- */

  const size =
    item.sizeLabel ||
    item.size ||
    '';

  if (size) {

    lines.push({
      type: 'text',
      text: size
    });

  }


  /* -------------------------------------------------------
     SABORES
  ------------------------------------------------------- */

  const flavors =
    Array.isArray(item.flavors)
      ? item.flavors
      : [];


  /* UN SABOR */

  if (flavors.length === 1) {

    lines.push({
      type: 'text',
      text:
        `Sabor: ${flavors[0]}`
    });

  }


  /* MITAD Y MITAD */

  if (flavors.length >= 2) {

    lines.push({
      type: 'text',
      text:
        `Sabores: ${flavors[0]} / ${flavors[1]}`
    });

  }


  /* -------------------------------------------------------
     EXTRAS
  ------------------------------------------------------- */

  const extra =
    extrasText(item.extras);

  if (extra) {

    lines.push({
      type: 'text',
      text:
        `Extra: ${extra}`
    });

  }


  /* -------------------------------------------------------
     REFRESCO COMPRADO APARTE
  ------------------------------------------------------- */

  if (
    item.beverageName &&
    Number(item.beveragePrice || 0) > 0
  ) {

    lines.push({
      type: 'text',
      text:
        `Refresco: ${item.beverageName}`
    });

  }


  return lines;
}


/* =========================================================
   TICKET / COMANDA
========================================================= */

export default function Ticket({

  items = [],

  serviceType = 'takeaway',

  tableNumber = '',

  printedAt = null,

  orderCode = ''

}) {

  /* =======================================================
     FECHA Y HORA
  ======================================================= */

  const {
    date,
    time
  } = getDateTime(printedAt);


  /* =======================================================
     TIPO DE SERVICIO
  ======================================================= */

  const serviceLabel =
    serviceType === 'table' &&
    String(tableNumber).trim()
      ? `MESA ${String(tableNumber).trim()}`
      : 'PARA LLEVAR';


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div className="ticket">

      {/* =================================================
          CABECERA
      ================================================= */}

      <div className="ticket-header">

        <h2>
          PIZZERÍA KIKIS
        </h2>


        {orderCode && (
          <div className="ticket-place ticket-code">
            {orderCode}
          </div>
        )}


        <div className="ticket-place">
          {serviceLabel}
        </div>


        <div className="ticket-date">
          {date} {time}
        </div>

      </div>


      {/* =================================================
          SEPARADOR
      ================================================= */}

      <div className="ticket-line" />


      {/* =================================================
          PEDIDOS
      ================================================= */}

      <div className="ticket-body">

        {items.length === 0 ? (

          <div className="ticket-empty">
            Sin productos
          </div>

        ) : (

          items.map(
            (item, index) => {

              const lines =
                formatItem(item);


              return (

                <React.Fragment
                  key={
                    item.uid ||
                    `${item.name}-${index}`
                  }
                >

                  {/* =======================================
                      PRODUCTO
                  ======================================= */}

                  <div className="ticket-item">

                    {lines.map(
                      (
                        line,
                        lineIndex
                      ) => (

                        <div
                          key={lineIndex}
                          className={
                            line.type === 'title'
                              ? 'ticket-title'
                              : line.type === 'subtitle'
                                ? 'ticket-subtitle'
                                : 'ticket-row'
                          }
                        >

                          {line.text}

                        </div>

                      )
                    )}

                  </div>


                  {/* =======================================
                      SEPARADOR ENTRE PRODUCTOS
                  ======================================= */}

                  {index <
                    items.length - 1 && (

                    <div className="ticket-line" />

                  )}

                </React.Fragment>

              );

            }
          )

        )}

      </div>

    </div>

  );
}