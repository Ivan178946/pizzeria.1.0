import { useMemo, useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { money } from '../utils/format.js';

// =========================================================
// TAMAÑOS Y PRECIOS POR TIPO DE PRODUCTO
// =========================================================

export function getSizes(kind) {
  return (
    kind === 'individual'
      ? [
          ['Personal', 19],
          ['Pequeña', 33],
          ['Mediana', 49],
          ['Grande', 59],
          ['Familiar', 79],
          ['Super', 89],
          ['Jumbo', 139],
          ['Interminable', 169]
        ]
      : kind === 'double'
        ? [
            ['Pequeña', 60],
            ['Mediana', 89],
            ['Grande', 109],
            ['Familiares', 149]
          ]
        : [
            ['Personal', 50],
            ['Pequeña', 55],
            ['Mediana', 65],
            ['Grande', 75],
            ['Familiar', 90]
          ]
  );
}

// Precios que fijó el administrador; si el servidor aún no
// los envía se usan los de siempre.
export function productSizes(product) {
  return Array.isArray(product?.sizes) && product.sizes.length
    ? product.sizes.map(s => [s.name, Number(s.price)])
    : getSizes(product?.kind);
}

export default function Configurator({
  product,
  flavors = [],
  beverages = [],
  extras = [],
  onClose,
  onAdd
}) {
  const kind = product.kind;

  // =========================================================
  // TAMAÑOS Y PRECIOS
  // =========================================================

  const sizes = productSizes(product);

  const [size, setSize] = useState(
    sizes[0]?.[0] || ''
  );

  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');

  // =========================================================
  // EXTRAS
  // =========================================================

  // Pizza individual / combo
  const [selectedExtras, setSelectedExtras] = useState([]);

  // Promo 2 pizzas
  const [selectedExtrasPizza1, setSelectedExtrasPizza1] = useState([]);
  const [selectedExtrasPizza2, setSelectedExtrasPizza2] = useState([]);

  // =========================================================
  // PRECIO BASE
  // =========================================================

  const basePrice = useMemo(() => {
    const selected = sizes.find(
      item => item[0] === size
    );

    return Number(
      selected?.[1] ??
      product.price ??
      0
    );
  }, [size, product.price, kind]);

  // =========================================================
  // PRECIO EXTRAS
  // =========================================================

  const extrasPriceIndividual = useMemo(() => {
    return selectedExtras.reduce(
      (sum, extra) =>
        sum + Number(extra.price || 0),
      0
    );
  }, [selectedExtras]);

  const extrasPricePizza1 = useMemo(() => {
    return selectedExtrasPizza1.reduce(
      (sum, extra) =>
        sum + Number(extra.price || 0),
      0
    );
  }, [selectedExtrasPizza1]);

  const extrasPricePizza2 = useMemo(() => {
    return selectedExtrasPizza2.reduce(
      (sum, extra) =>
        sum + Number(extra.price || 0),
      0
    );
  }, [selectedExtrasPizza2]);

  const extrasPrice =
    kind === 'double'
      ? extrasPricePizza1 + extrasPricePizza2
      : extrasPriceIndividual;

  // =========================================================
  // PRECIO FINAL
  // =========================================================

  const finalPrice =
    basePrice + extrasPrice;

  // =========================================================
  // VALIDACIÓN
  // =========================================================

  const canAdd =
    Boolean(f1) &&
    (
      kind !== 'double' ||
      Boolean(f2)
    );

  // =========================================================
  // CONVERTIR EXTRAS
  // =========================================================

  function extrasData(list) {
    return list.map(extra => ({
      id: extra.id,
      name: extra.name,
      price: Number(extra.price || 0)
    }));
  }

  // =========================================================
  // EXTRA PARA PIZZA INDIVIDUAL / COMBO
  // =========================================================

  function toggleExtra(extra) {
    setSelectedExtras(current => {

      const exists = current.some(
        item => item.id === extra.id
      );

      if (exists) {
        return current.filter(
          item => item.id !== extra.id
        );
      }

      return [
        ...current,
        extra
      ];
    });
  }

  // =========================================================
  // EXTRA PIZZA 1
  // =========================================================

  function toggleExtraPizza1(extra) {
    setSelectedExtrasPizza1(current => {

      const exists = current.some(
        item => item.id === extra.id
      );

      if (exists) {
        return current.filter(
          item => item.id !== extra.id
        );
      }

      return [
        ...current,
        extra
      ];
    });
  }

  // =========================================================
  // EXTRA PIZZA 2
  // =========================================================

  function toggleExtraPizza2(extra) {
    setSelectedExtrasPizza2(current => {

      const exists = current.some(
        item => item.id === extra.id
      );

      if (exists) {
        return current.filter(
          item => item.id !== extra.id
        );
      }

      return [
        ...current,
        extra
      ];
    });
  }

  // =========================================================
  // AGREGAR A COMANDA
  // =========================================================

  function add() {
    if (!canAdd) return;

    // =======================================================
    // PROMO 2 PIZZAS
    // =======================================================

    if (kind === 'double') {

      const pizza1Extras =
        extrasData(selectedExtrasPizza1);

      const pizza2Extras =
        extrasData(selectedExtrasPizza2);

      onAdd({
        name: product.name,
        productId: product.id,
        kind,

        size,
        sizeLabel: size,

        flavors: [
          f1,
          f2
        ],

        // Información individual de cada pizza
        pizzas: [
          {
            number: 1,
            size,
            flavor: f1,
            extras: pizza1Extras
          },
          {
            number: 2,
            size,
            flavor: f2,
            extras: pizza2Extras
          }
        ],

        // También conservamos extras generales
        // para compatibilidad con el sistema actual.
        extras: [
          ...pizza1Extras,
          ...pizza2Extras
        ],

        extrasPrice,

        basePrice,
        price: finalPrice
      });

      return;
    }

    // =======================================================
    // PIZZA INDIVIDUAL
    // =======================================================

    if (kind === 'individual') {

      const extrasDataSelected =
        extrasData(selectedExtras);

      onAdd({
        name: product.name,
        productId: product.id,
        kind,

        size,
        sizeLabel: size,

        flavors: [
          f1,
          ...(f2 ? [f2] : [])
        ],

        extras: extrasDataSelected,
        extrasPrice,

        basePrice,
        price: finalPrice
      });

      return;
    }

    // =======================================================
    // PIZZA + GASEOSA
    // =======================================================

    const extrasDataSelected =
      extrasData(selectedExtras);

    onAdd({
      name: product.name,
      productId: product.id,
      kind,

      size,
      sizeLabel: size,

      flavors: [
        f1
      ],

      beverageIncluded: true,
      beverageName: 'Gaseosa incluida',
      beveragePrice: 0,

      extras: extrasDataSelected,
      extrasPrice,

      basePrice,
      price: finalPrice
    });
  }

  // =========================================================
  // COMPONENTE DE EXTRAS
  // =========================================================

  function ExtrasSelector({
    selected,
    onToggle
  }) {
    if (!extras.length) {
      return (
        <div className="empty compact">
          No hay ingredientes extras disponibles.
        </div>
      );
    }

    return (
      <div className="extras-list">

        {extras.map(extra => {

          const isSelected =
            selected.some(
              item => item.id === extra.id
            );

          return (
            <button
              type="button"
              key={extra.id}
              className={
                isSelected
                  ? 'extra-option selected'
                  : 'extra-option'
              }
              onClick={() =>
                onToggle(extra)
              }
            >

              <span className="extra-check">

                {isSelected && (
                  <Check size={14} />
                )}

              </span>

              <span className="extra-name">
                {extra.name}
              </span>

              <strong>
                +{money(extra.price)}
              </strong>

            </button>
          );
        })}

      </div>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="modal-backdrop">

      <div className="modal modal-wide">

        {/* CERRAR */}

        <button
          className="modal-close"
          onClick={onClose}
          type="button"
        >
          <X />
        </button>

        <span className="eyebrow">
          CONFIGURAR PEDIDO
        </span>

        <h2>
          {product.name}
        </h2>

        <p>
          {kind === 'individual'
            ? 'Elige tamaño, 1 o 2 sabores e ingredientes extras.'
            : kind === 'double'
              ? 'Configura cada una de las dos pizzas por separado.'
              : 'Elige tamaño, un sabor e ingredientes extras. La gaseosa está incluida.'}
        </p>

        {/* =====================================================
            TAMAÑO
        ===================================================== */}

        <div className="size-picker">

          <span className="size-picker-label">
            Tamaño
          </span>

          <div className="size-grid">

            {sizes.map(([name, price]) => (

              <button
                key={name}
                type="button"
                className={
                  size === name
                    ? 'size-option active'
                    : 'size-option'
                }
                onClick={() => setSize(name)}
              >
                <span>{name}</span>
                <b>{money(price)}</b>
              </button>

            ))}

          </div>

        </div>


        {/* =====================================================
            PROMO 2 PIZZAS
        ===================================================== */}

        {kind === 'double' ? (

          <>

            {/* ===========================
                PIZZA 1
            =========================== */}

            <div className="promo-pizza-box">

              <div className="promo-pizza-title">
                <strong>
                  🍕 PIZZA 1
                </strong>

                <span>
                  {size}
                </span>
              </div>

              <label>

                Sabor

                <select
                  value={f1}
                  onChange={e =>
                    setF1(e.target.value)
                  }
                >

                  <option value="">
                    Seleccione sabor
                  </option>

                  {flavors.map(flavor => (

                    <option
                      key={flavor.id}
                      value={flavor.name}
                    >
                      {flavor.name}
                    </option>

                  ))}

                </select>

              </label>

              <div className="pizza-extra-title">
                Ingredientes extra
                <span>Opcional</span>
              </div>

              <ExtrasSelector
                selected={selectedExtrasPizza1}
                onToggle={toggleExtraPizza1}
              />

            </div>


            {/* ===========================
                PIZZA 2
            =========================== */}

            <div className="promo-pizza-box">

              <div className="promo-pizza-title">
                <strong>
                  🍕 PIZZA 2
                </strong>

                <span>
                  {size}
                </span>
              </div>

              <label>

                Sabor

                <select
                  value={f2}
                  onChange={e =>
                    setF2(e.target.value)
                  }
                >

                  <option value="">
                    Seleccione sabor
                  </option>

                  {flavors.map(flavor => (

                    <option
                      key={flavor.id}
                      value={flavor.name}
                    >
                      {flavor.name}
                    </option>

                  ))}

                </select>

              </label>

              <div className="pizza-extra-title">
                Ingredientes extra
                <span>Opcional</span>
              </div>

              <ExtrasSelector
                selected={selectedExtrasPizza2}
                onToggle={toggleExtraPizza2}
              />

            </div>

          </>

        ) : (

          /* =====================================================
             INDIVIDUAL / COMBO
          ===================================================== */

          <>

            {/* ===========================
                SABOR PRINCIPAL
            =========================== */}

            <label>

              Sabor

              <select
                value={f1}
                onChange={e =>
                  setF1(e.target.value)
                }
              >

                <option value="">
                  Seleccione sabor
                </option>

                {flavors.map(flavor => (

                  <option
                    key={flavor.id}
                    value={flavor.name}
                  >
                    {flavor.name}
                  </option>

                ))}

              </select>

            </label>


            {/* ===========================
                SEGUNDO SABOR
                SOLO INDIVIDUAL
            =========================== */}

            {kind === 'individual' && (

              <label>

                Segundo sabor — opcional

                <select
                  value={f2}
                  onChange={e =>
                    setF2(e.target.value)
                  }
                >

                  <option value="">
                    Sin segundo sabor
                  </option>

                  {flavors.map(flavor => (

                    <option
                      key={flavor.id}
                      value={flavor.name}
                    >
                      {flavor.name}
                    </option>

                  ))}

                </select>

              </label>

            )}


            {/* ===========================
                GASEOSA INCLUIDA
            =========================== */}

            {kind === 'combo' && (

              <div className="included-beverage">

                <span>
                  🥤
                </span>

                <div>

                  <strong>
                    Gaseosa incluida
                  </strong>

                  <small>
                    El combo incluye una gaseosa gratis.
                  </small>

                </div>

                <b>
                  GRATIS
                </b>

              </div>

            )}


            {/* ===========================
                EXTRAS
            =========================== */}

            <div className="extras-section">

              <div className="extras-title">

                <div>

                  <span className="eyebrow">
                    PERSONALIZACIÓN
                  </span>

                  <strong>
                    Ingredientes extras
                  </strong>

                </div>

                <span>
                  Opcional
                </span>

              </div>

              <ExtrasSelector
                selected={selectedExtras}
                onToggle={toggleExtra}
              />

            </div>

          </>

        )}


        {/* =====================================================
            RESUMEN DE PRECIO
        ===================================================== */}

        <div className="price-breakdown">

          <div>

            <span>
              Pizza
            </span>

            <strong>
              {money(basePrice)}
            </strong>

          </div>

          {kind === 'double' && extrasPricePizza1 > 0 && (

            <div>

              <span>
                Extras Pizza 1
              </span>

              <strong>
                +{money(extrasPricePizza1)}
              </strong>

            </div>

          )}

          {kind === 'double' && extrasPricePizza2 > 0 && (

            <div>

              <span>
                Extras Pizza 2
              </span>

              <strong>
                +{money(extrasPricePizza2)}
              </strong>

            </div>

          )}

          {kind !== 'double' &&
            selectedExtras.length > 0 && (

              <div>

                <span>
                  Ingredientes extras
                </span>

                <strong>
                  +{money(extrasPrice)}
                </strong>

              </div>

          )}

          {kind === 'combo' && (

            <div>

              <span>
                Gaseosa incluida
              </span>

              <strong>
                GRATIS
              </strong>

            </div>

          )}

        </div>


        {/* =====================================================
            TOTAL
        ===================================================== */}

        <div className="modal-total">

          <span>
            Total
          </span>

          <b>
            {money(finalPrice)}
          </b>

        </div>


        {/* =====================================================
            AGREGAR
        ===================================================== */}

        <button
          className="primary full big"
          disabled={!canAdd}
          onClick={add}
          type="button"
        >

          <Plus size={18} />

          Agregar a la comanda

        </button>

      </div>

    </div>
  );
}