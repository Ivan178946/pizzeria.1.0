import { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { money } from '../utils/format.js';

// =========================================================
// ARMAR UNA OPCIÓN DE PROMOCIÓN EN EL PUNTO DE VENTA
// El precio lo fija el administrador; aquí solo se eligen
// los sabores de cada pizza y los refrescos "a elección".
// =========================================================

// La "Promo 2 Pizzas" del menú trae dos pizzas por unidad
const pizzasPerUnit = kind => (kind === 'double' ? 2 : 1);

export default function PromoConfigurator({
  promo,
  option,
  flavors = [],
  beverages = [],
  onClose,
  onAdd
}) {
  const items = Array.isArray(option?.items) ? option.items : [];

  // Una entrada por cada pizza física: 2× Mediana → 2 pizzas
  const pizzaUnits = items
    .filter(i => i.type === 'product')
    .flatMap(i =>
      Array(i.qty * pizzasPerUnit(i.kind)).fill({
        size: i.size,
        label: i.label
      })
    );

  // Una entrada por refresco: fijo (ya elegido por el admin)
  // o a elección del cliente.
  const drinkUnits = items
    .filter(i => i.type === 'beverage')
    .flatMap(i => Array(i.qty).fill(i.beverageId ? i.label : ''));

  const others = items.filter(i => i.type === 'other');

  const beverageOptions = beverages.length
    ? beverages.map(b => b.name)
    : ['Refresco de la casa'];

  const [pizzaFlavors, setPizzaFlavors] = useState(() => pizzaUnits.map(() => ''));
  const [drinks, setDrinks] = useState(() => [...drinkUnits]);

  const canAdd =
    pizzaFlavors.every(Boolean) &&
    drinks.every(Boolean);

  function setAt(setter, index, value) {
    setter(current => current.map((v, i) => (i === index ? value : v)));
  }

  const title = promo.title || promo.name;

  function add() {
    if (!canAdd) return;

    onAdd({
      name: `${title} — ${option.name}`,
      kind: 'promo',
      promoId: promo.id,
      optionId: option.id,
      promoTitle: title,
      optionName: option.name,
      emoji: promo.emoji,

      size: '',
      sizeLabel: option.summary,
      optionSummary: option.summary,

      flavors: [...pizzaFlavors],

      pizzas: pizzaUnits.map((unit, i) => ({
        number: i + 1,
        size: unit.size,
        sizeLabel: unit.size,
        flavor: pizzaFlavors[i],
        extras: []
      })),

      beverages: [...drinks],
      beverageName: drinks.join(', '),
      beveragePrice: 0,

      others: others.map(o => ({ name: o.label, qty: o.qty })),

      extras: [],
      normalPrice: option.normalPrice,
      basePrice: option.promoPrice,
      price: option.promoPrice
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide promo-modal">

        <button className="modal-close" onClick={onClose} type="button">
          <X />
        </button>

        <span className="eyebrow">PROMOCIÓN · {title}</span>

        <h2>
          <span className="promo-modal-emoji">{promo.emoji}</span>
          {option.name}
        </h2>

        <p>
          {promo.description || 'Elige el sabor de cada pizza y los refrescos incluidos.'}
        </p>

        <div className="promo-modal-summary">{option.summary}</div>

        {pizzaUnits.map((unit, i) => (
          <div className="promo-pizza-box" key={`p${i}`}>
            <div className="promo-pizza-title">
              <strong>🍕 PIZZA {i + 1}</strong>
              <span>{unit.size}</span>
            </div>

            <div className="promo-flavor-chips">
              {flavors.map(flavor => (
                <button
                  key={flavor.id}
                  type="button"
                  className={pizzaFlavors[i] === flavor.name ? 'active' : ''}
                  onClick={() => setAt(setPizzaFlavors, i, flavor.name)}
                >
                  {flavor.name}
                </button>
              ))}
            </div>
          </div>
        ))}

        {drinks.map((drink, i) =>
          drinkUnits[i] ? (
            <div className="included-beverage" key={`b${i}`}>
              <span>🥤</span>
              <div>
                <strong>{drinkUnits[i]}</strong>
                <small>Refresco incluido</small>
              </div>
              <b>INCLUIDO</b>
            </div>
          ) : (
            <div className="promo-pizza-box" key={`b${i}`}>
              <div className="promo-pizza-title">
                <strong>🥤 REFRESCO {drinks.length > 1 ? i + 1 : ''}</strong>
                <span>A elección</span>
              </div>

              <div className="promo-flavor-chips">
                {beverageOptions.map(name => (
                  <button
                    key={name}
                    type="button"
                    className={drink === name ? 'active' : ''}
                    onClick={() => setAt(setDrinks, i, name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {others.length > 0 && (
          <div className="included-beverage">
            <span>🎁</span>
            <div>
              <strong>También incluye</strong>
              <small>{others.map(o => `${o.qty}× ${o.label}`).join(', ')}</small>
            </div>
            <b>INCLUIDO</b>
          </div>
        )}

        <div className="modal-total">
          <span>
            Precio de la promoción
            {option.savings > 0 && (
              <small className="promo-modal-savings">
                {' '}· antes {money(option.normalPrice)}, ahorra {money(option.savings)}
              </small>
            )}
          </span>
          <b>{money(option.promoPrice)}</b>
        </div>

        <button
          className="primary full big"
          disabled={!canAdd}
          onClick={add}
          type="button"
        >
          <Plus size={18} />
          {canAdd ? 'Agregar a la comanda' : 'Elige todos los sabores'}
        </button>

      </div>
    </div>
  );
}
