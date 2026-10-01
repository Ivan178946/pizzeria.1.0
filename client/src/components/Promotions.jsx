import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ArrowDown,
  ArrowUp,
  Beer,
  CalendarDays,
  Check,
  Coins,
  Copy,
  ImageUp,
  Pause,
  Pencil,
  Pizza,
  Play,
  Plus,
  Save,
  Sparkles,
  Tag,
  Trash2,
  X
} from 'lucide-react';

import { api } from '../services/api.js';
import ProductsAdmin from './ProductsAdmin.jsx';
import { money, todayISO } from '../utils/format.js';
import { readImage } from '../utils/image.js';

// =========================================================
// PRECIOS Y PROMOCIONES (SOLO ADMINISTRADOR)
// - Editar precios de pizzas, refrescos y extras.
// - Crear promociones flexibles: cada promoción tiene varias
//   opciones (combos) con cualquier producto y cantidad.
// - Administrar sabores.
// =========================================================

const EMOJIS = ['🎉', '🔥', '🍕', '⭐', '💥', '🎁', '❤️', '👨‍👩‍👧', '⚽', '🎂', '🌸', '🎒'];

const TABS = [
  ['precios', 'Precios', Coins],
  ['promos', 'Promociones', Sparkles],
  ['sabores', 'Sabores', Pizza]
];

const uid = () => Math.random().toString(36).slice(2, 10);

function newOption(items) {
  return {
    key: uid(),
    id: null,
    name: '',
    promoPrice: '',
    active: true,
    items: items || []
  };
}

function emptyForm(defaultItems = []) {
  return {
    id: null,
    title: '',
    description: '',
    emoji: '🎉',
    image: '',
    active: true,
    startDate: '',
    endDate: '',
    options: [newOption(defaultItems)]
  };
}

// Valor del <select> de cada producto de la opción
function itemValue(item) {
  if (item.type === 'product') return `p:${item.productId}:${item.size}`;
  if (item.type === 'beverage') return `b:${item.beverageId || 'any'}`;
  return 'o';
}

function itemFromValue(value, qty = 1) {
  const [kind, id, ...rest] = value.split(':');

  if (kind === 'p') {
    return { key: uid(), type: 'product', productId: Number(id), size: rest.join(':'), qty };
  }

  if (kind === 'b') {
    return { key: uid(), type: 'beverage', beverageId: id === 'any' ? null : Number(id), qty };
  }

  return { key: uid(), type: 'other', name: '', unitPrice: '', qty };
}

// ¿En qué estado está la promoción hoy?
function promoStatus(promo) {
  const today = todayISO();

  if (!promo.active) return ['paused', 'Pausada'];
  if (promo.startDate && today < promo.startDate) return ['scheduled', `Desde ${shortDate(promo.startDate)}`];
  if (promo.endDate && today > promo.endDate) return ['expired', 'Vencida'];
  return ['live', 'Activa'];
}

function shortDate(value) {
  const [y, m, d] = String(value || '').split('-');
  return d ? `${d}/${m}/${y}` : '';
}

export default function Promotions({ reload }) {
  const [promotions, setPromotions] = useState([]);
  const [catalog, setCatalog] = useState({ flavors: [], beverages: [], extras: [] });
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState('precios');
  const fileRef = useRef(null);

  async function load() {
    try {
      const [promos, cat, prods] = await Promise.all([
        api('/api/admin/promotions'),
        api('/api/admin/catalog'),
        api('/api/admin/products')
      ]);

      setPromotions(Array.isArray(promos) ? promos : []);
      setProducts(Array.isArray(prods) ? prods : []);
      setCatalog({
        flavors: cat?.flavors || [],
        beverages: cat?.beverages || [],
        extras: cat?.extras || []
      });
    } catch (error) {
      flash(error.message, 'error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  function flash(text, type = 'success') {
    setNotice({ text, type, at: Date.now() });
    setTimeout(() => setNotice(n => (n && n.text === text ? null : n)), 3500);
  }

  // Después de cualquier cambio se recarga esta página y el
  // menú del punto de venta.
  async function afterChange(text) {
    await load();
    reload();
    flash(text);
  }


  // =========================================================
  // PRODUCTOS DISPONIBLES PARA LAS OPCIONES
  // Cualquier producto del menú (con cada tamaño), cualquier
  // refresco, o un producto libre ("Papas fritas").
  // =========================================================

  const productChoices = useMemo(
    () =>
      products.flatMap(p =>
        (p.sizes || []).map(s => ({
          value: `p:${p.id}:${s.name}`,
          label: `${p.name} — ${s.name}`,
          price: Number(s.price),
          off: !p.active
        }))
      ),
    [products]
  );

  const cheapestDrink = useMemo(() => {
    const activeDrinks = catalog.beverages.filter(b => b.active);
    return activeDrinks.length
      ? Math.min(...activeDrinks.map(b => Number(b.price || 0)))
      : 0;
  }, [catalog.beverages]);

  // Opción inicial de una promoción nueva: 2 pizzas medianas + 1 refresco
  function defaultItems() {
    const individual = products.find(p => p.kind === 'individual' && p.active) || products[0];
    const size =
      individual?.sizes?.find(s => s.name.toLowerCase().startsWith('median')) ||
      individual?.sizes?.[0];

    const items = [];

    if (individual && size) {
      items.push({ key: uid(), type: 'product', productId: individual.id, size: size.name, qty: 2 });
    }

    items.push({ key: uid(), type: 'beverage', beverageId: null, qty: 1 });

    return items;
  }

  function resetForm() {
    setForm(emptyForm(defaultItems()));
  }

  // La primera vez que llegan los productos se arma la opción por defecto
  useEffect(() => {
    if (!form.id && products.length && form.options.length === 1 && !form.options[0].items.length) {
      resetForm();
    }
  }, [products]);

  // Precio normal de una unidad
  function unitPrice(item) {
    if (item.type === 'product') {
      return productChoices.find(c => c.value === itemValue(item))?.price || 0;
    }

    if (item.type === 'beverage') {
      if (!item.beverageId) return cheapestDrink;
      return Number(catalog.beverages.find(b => b.id === item.beverageId)?.price || 0);
    }

    return Number(item.unitPrice || 0);
  }

  function itemLabel(item) {
    if (item.type === 'product') {
      return productChoices.find(c => c.value === itemValue(item))?.label || `Pizza ${item.size}`;
    }

    if (item.type === 'beverage') {
      return item.beverageId
        ? catalog.beverages.find(b => b.id === item.beverageId)?.name || 'Refresco'
        : 'Refresco a elección';
    }

    return item.name || 'Producto';
  }

  function normalPrice(option) {
    return option.items.reduce((sum, item) => sum + unitPrice(item) * Number(item.qty || 0), 0);
  }

  function summary(option) {
    return option.items.map(i => `${i.qty}× ${itemLabel(i)}`).join(' + ');
  }


  // =========================================================
  // FORMULARIO: PROMOCIÓN
  // =========================================================

  function setField(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function chooseImage(e) {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    try {
      setField('image', await readImage(file, { maxSize: 480, keepPng: true }));
    } catch (error) {
      flash(error.message, 'error');
    }
  }


  // =========================================================
  // FORMULARIO: OPCIONES
  // =========================================================

  function setOption(key, patch) {
    setForm(current => ({
      ...current,
      options: current.options.map(o => (o.key === key ? { ...o, ...patch } : o))
    }));
  }

  function addOption() {
    setForm(current => ({
      ...current,
      options: [...current.options, newOption(defaultItems())]
    }));
  }

  function duplicateOption(option) {
    setForm(current => {
      const index = current.options.findIndex(o => o.key === option.key);
      const copy = {
        ...option,
        key: uid(),
        id: null,
        name: option.name ? `${option.name} (copia)` : '',
        items: option.items.map(i => ({ ...i, key: uid() }))
      };

      const options = [...current.options];
      options.splice(index + 1, 0, copy);
      return { ...current, options };
    });
  }

  function removeOption(key) {
    setForm(current => ({
      ...current,
      options: current.options.filter(o => o.key !== key)
    }));
  }

  function moveOption(key, delta) {
    setForm(current => {
      const options = [...current.options];
      const from = options.findIndex(o => o.key === key);
      const to = from + delta;

      if (to < 0 || to >= options.length) return current;

      [options[from], options[to]] = [options[to], options[from]];
      return { ...current, options };
    });
  }

  function setItem(optionKey, itemKey, patch) {
    setForm(current => ({
      ...current,
      options: current.options.map(o =>
        o.key !== optionKey
          ? o
          : { ...o, items: o.items.map(i => (i.key === itemKey ? { ...i, ...patch } : i)) }
      )
    }));
  }

  function changeItemProduct(optionKey, item, value) {
    const next = itemFromValue(value, item.qty);

    // Conservar nombre y precio si sigue siendo un producto libre
    if (next.type === 'other' && item.type === 'other') return;

    setForm(current => ({
      ...current,
      options: current.options.map(o =>
        o.key !== optionKey
          ? o
          : { ...o, items: o.items.map(i => (i.key === item.key ? { ...next, key: i.key } : i)) }
      )
    }));
  }

  function addItem(optionKey) {
    const first = productChoices.find(c => !c.off) || productChoices[0];

    setForm(current => ({
      ...current,
      options: current.options.map(o =>
        o.key !== optionKey
          ? o
          : { ...o, items: [...o.items, itemFromValue(first ? first.value : 'o', 1)] }
      )
    }));
  }

  function removeItem(optionKey, itemKey) {
    setForm(current => ({
      ...current,
      options: current.options.map(o =>
        o.key !== optionKey ? o : { ...o, items: o.items.filter(i => i.key !== itemKey) }
      )
    }));
  }


  // =========================================================
  // GUARDAR
  // =========================================================

  // La promoción principal NO tiene precio: cada opción
  // tiene su propio precio promocional.
  // Una opción sin productos o sin precio no se guarda.
  const optionPrice = o => Number(String(o.promoPrice ?? '').replace(',', '.'));

  const isSavableOption = o =>
    o.items.length > 0 &&
    optionPrice(o) > 0;

  const optionErrors = form.options.map(o => {
    if (!isSavableOption(o)) return 'Sin productos o sin precio: esta opción no se guardará';
    if (o.items.some(i => !(Number(i.qty) > 0))) return 'Cada producto necesita una cantidad mayor a 0';
    if (o.items.some(i => i.type === 'other' && !String(i.name || '').trim())) return 'Escribe el nombre de cada producto libre';
    return '';
  });

  // Errores que sí impiden guardar (en opciones que se van a guardar)
  const blockingErrors = form.options.filter(
    (o, i) => isSavableOption(o) && optionErrors[i]
  );

  const datesOk = !form.startDate || !form.endDate || form.endDate >= form.startDate;

  const canSave =
    form.title.trim() &&
    form.options.some(isSavableOption) &&
    blockingErrors.length === 0 &&
    datesOk;

  async function savePromotion() {
    if (!canSave) return;

    try {
      setSaving(true);

      const promotionPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        emoji: form.emoji,
        image: form.image,
        active: form.active,
        startDate: form.startDate,
        endDate: form.endDate,
        options: form.options
          .filter(isSavableOption)
          .map(o => ({
            id: o.id,
            name: o.name.trim(),
            promoPrice: optionPrice(o),
            active: o.active,
            items: o.items.map(i => ({
              type: i.type,
              productId: i.productId,
              size: i.size,
              beverageId: i.beverageId,
              name: i.name,
              unitPrice: Number(i.unitPrice || 0),
              quantity: Number(i.qty)
            }))
          }))
      };

      // TEMPORAL: revisar en F12 → Console qué se envía al servidor
      console.log('PROMOCION A GUARDAR:', promotionPayload);

      const body = JSON.stringify(promotionPayload);

      if (form.id) {
        await api(`/api/admin/promotions/${form.id}`, { method: 'PATCH', body });
      } else {
        await api('/api/admin/promotions', { method: 'POST', body });
      }

      const text = form.id
        ? `Promoción "${form.title.trim()}" actualizada`
        : `Promoción "${form.title.trim()}" creada`;

      resetForm();
      await afterChange(text);

    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function editPromotion(promo) {
    setForm({
      id: promo.id,
      title: promo.title || promo.name,
      description: promo.description || '',
      emoji: promo.emoji || '🎉',
      image: promo.image || '',
      active: Boolean(promo.active),
      startDate: promo.startDate || '',
      endDate: promo.endDate || '',
      options: (promo.options || []).map(o => ({
        key: uid(),
        id: o.id,
        name: o.name,
        promoPrice: String(o.promoPrice),
        active: Boolean(o.active),
        items: o.items.map(i => ({
          key: uid(),
          type: i.type,
          productId: i.productId,
          size: i.size,
          beverageId: i.beverageId || null,
          name: i.name || '',
          unitPrice: i.type === 'other' ? String(i.unitPrice || '') : '',
          qty: i.qty
        }))
      }))
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function togglePromotion(promo) {
    try {
      await api(`/api/admin/promotions/${promo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !promo.active })
      });

      await afterChange(
        promo.active
          ? `"${promo.title}" pausada: ya no aparece en el punto de venta`
          : `"${promo.title}" activada`
      );
    } catch (error) {
      flash(error.message, 'error');
    }
  }

  async function toggleOption(promo, option) {
    try {
      await api(`/api/admin/promotions/${promo.id}/options/${option.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !option.active })
      });

      await afterChange(
        option.active
          ? `Opción "${option.name}" desactivada`
          : `Opción "${option.name}" activada`
      );
    } catch (error) {
      flash(error.message, 'error');
    }
  }

  async function deletePromotion(promo) {
    if (!confirm(`¿Eliminar la promoción "${promo.title}" y todas sus opciones?\n\nLas ventas ya registradas no se modifican.`)) {
      return;
    }

    try {
      await api(`/api/admin/promotions/${promo.id}`, { method: 'DELETE' });

      if (form.id === promo.id) resetForm();

      await afterChange(`Promoción "${promo.title}" eliminada`);
    } catch (error) {
      flash(error.message, 'error');
    }
  }

  const activeCount = promotions.filter(p => promoStatus(p)[0] === 'live').length;


  // =========================================================
  // INTERFAZ
  // =========================================================

  return (
    <div className="admin promos-page">

      {notice && (
        <div className={`pm-notice ${notice.type}`} key={notice.at}>
          {notice.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {notice.text}
        </div>
      )}

      <div className="stats">
        <div>
          <span>Promociones activas</span>
          <b>{activeCount}</b>
          <Sparkles />
        </div>
        <div>
          <span>Sabores en el menú</span>
          <b>{catalog.flavors.filter(f => f.active).length}</b>
          <Pizza />
        </div>
        <div>
          <span>Refrescos en venta</span>
          <b>{catalog.beverages.filter(b => b.active).length}</b>
          <Beer />
        </div>
      </div>

      <div className="pm-tabs" role="tablist">
        {TABS.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* =================================================
          PRECIOS: PIZZAS, REFRESCOS Y EXTRAS
      ================================================= */}

      {tab === 'precios' && (
        <div className="pm-tab-body" key="precios">
          <ProductsAdmin
            products={products}
            onChange={afterChange}
            onError={text => flash(text, 'error')}
          />

          <div className="pm-catalog two">
            <CatalogPanel
              type="beverages"
              title="Refrescos"
              eyebrow="BEBIDAS"
              icon="🥤"
              items={catalog.beverages}
              hasPrice
              onChange={afterChange}
              onError={text => flash(text, 'error')}
            />
            <CatalogPanel
              type="extras"
              title="Ingredientes extra"
              eyebrow="PERSONALIZACIÓN"
              icon="🧀"
              items={catalog.extras}
              hasPrice
              onChange={afterChange}
              onError={text => flash(text, 'error')}
            />
          </div>
        </div>
      )}

      {tab === 'promos' && (
      <div className="pm-layout">

        {/* =================================================
            FORMULARIO
        ================================================= */}

        <section className="panel pm-form">

          <div className="panel-title">
            <div>
              <span className="eyebrow">{form.id ? 'EDITAR' : 'NUEVA'} PROMOCIÓN</span>
              <h3>{form.id ? 'Modificar promoción' : 'Crear promoción'}</h3>
            </div>

            {form.id && (
              <button className="mini" type="button" onClick={resetForm}>
                <X size={14} /> Cancelar
              </button>
            )}
          </div>

          <label className="pm-field">
            <span>Título principal</span>
            <input
              placeholder="Ej: Gran Inauguración, Promo Escolar, 2x1..."
              value={form.title}
              maxLength={100}
              onChange={e => setField('title', e.target.value)}
            />
          </label>

          <label className="pm-field">
            <span>Descripción <small>opcional</small></span>
            <input
              placeholder="Ej: Solo por esta semana"
              value={form.description}
              maxLength={200}
              onChange={e => setField('description', e.target.value)}
            />
          </label>

          {/* ---------- Imagen o ícono ---------- */}

          <div className="pm-field">
            <span>Imagen o ícono <small>opcional</small></span>

            <div className="pm-media">
              <div className="pm-media-preview">
                {form.image ? <img src={form.image} alt="" /> : <span>{form.emoji}</span>}
              </div>

              <div className="pm-media-controls">
                <div className="pm-emojis">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className={!form.image && form.emoji === emoji ? 'active' : ''}
                      onClick={() => setForm(current => ({ ...current, emoji, image: '' }))}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  onChange={chooseImage}
                />

                <div className="pm-add-buttons">
                  <button className="mini" type="button" onClick={() => fileRef.current?.click()}>
                    <ImageUp size={13} /> {form.image ? 'Cambiar imagen' : 'Subir imagen'}
                  </button>
                  {form.image && (
                    <button className="mini danger" type="button" onClick={() => setField('image', '')}>
                      <Trash2 size={13} /> Quitar imagen
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ---------- Estado y vigencia ---------- */}

          <div className="pm-dates">
            <label className="pm-field">
              <span><CalendarDays size={13} /> Inicio <small>opcional</small></span>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setField('startDate', e.target.value)}
              />
            </label>

            <label className="pm-field">
              <span><CalendarDays size={13} /> Finaliza <small>opcional</small></span>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={e => setField('endDate', e.target.value)}
              />
            </label>

            <div className="pm-field">
              <span>Estado</span>
              <button
                type="button"
                className={form.active ? 'pm-state on' : 'pm-state'}
                onClick={() => setField('active', !form.active)}
              >
                <span className={form.active ? 'pm-switch on' : 'pm-switch'}><i /></span>
                {form.active ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          </div>

          {!datesOk && (
            <small className="pm-warning">La fecha de finalización no puede ser anterior a la de inicio.</small>
          )}

          {/* ---------- Opciones ---------- */}

          <div className="pm-field">
            <span>Opciones de la promoción ({form.options.length})</span>

            <div className="pm-options">
              {form.options.map((option, oi) => {
                const normal = normalPrice(option);
                const promo = Number(option.promoPrice || 0);
                const savings = normal - promo;

                return (
                  <div className={option.active ? 'pm-option' : 'pm-option off'} key={option.key}>

                    <div className="pm-option-head">
                      <span className="pm-option-n">{oi + 1}</span>

                      <input
                        placeholder={summary(option) || 'Nombre de la opción (ej: 2 Medianas + Coca-Cola)'}
                        value={option.name}
                        maxLength={60}
                        onChange={e => setOption(option.key, { name: e.target.value })}
                      />

                      <button
                        type="button"
                        className={option.active ? 'pm-switch on' : 'pm-switch'}
                        title={option.active ? 'Opción activa — clic para desactivar' : 'Opción inactiva — clic para activar'}
                        onClick={() => setOption(option.key, { active: !option.active })}
                      >
                        <i />
                      </button>

                      <div className="pm-option-tools">
                        <button className="mini" type="button" title="Subir" disabled={oi === 0} onClick={() => moveOption(option.key, -1)}>
                          <ArrowUp size={12} />
                        </button>
                        <button className="mini" type="button" title="Bajar" disabled={oi === form.options.length - 1} onClick={() => moveOption(option.key, 1)}>
                          <ArrowDown size={12} />
                        </button>
                        <button className="mini" type="button" title="Duplicar" onClick={() => duplicateOption(option)}>
                          <Copy size={12} />
                        </button>
                        <button
                          className="mini danger"
                          type="button"
                          title="Eliminar opción"
                          disabled={form.options.length === 1}
                          onClick={() => removeOption(option.key)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="pm-components">
                      {option.items.map(item => (
                        <div className="pm-component" key={item.key}>
                          <span className="pm-component-icon">
                            {item.type === 'product' ? '🍕' : item.type === 'beverage' ? '🥤' : '🎁'}
                          </span>

                          <input
                            className="pm-qty"
                            type="number"
                            min="1"
                            max="20"
                            value={item.qty}
                            onChange={e =>
                              setItem(option.key, item.key, {
                                qty: Math.max(1, Math.min(20, Number(e.target.value) || 1))
                              })
                            }
                          />

                          <div className="pm-item-pick">
                            <select
                              value={itemValue(item)}
                              onChange={e => changeItemProduct(option.key, item, e.target.value)}
                            >
                              <optgroup label="Pizzas y productos del menú">
                                {productChoices.map(c => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}{c.off ? ' (oculto)' : ''}
                                  </option>
                                ))}
                                {/* producto guardado que ya no existe */}
                                {item.type === 'product' && !productChoices.some(c => c.value === itemValue(item)) && (
                                  <option value={itemValue(item)}>Pizza {item.size} (ya no existe)</option>
                                )}
                              </optgroup>
                              <optgroup label="Refrescos">
                                <option value="b:any">Refresco a elección del cliente</option>
                                {catalog.beverages.map(b => (
                                  <option key={b.id} value={`b:${b.id}`}>
                                    {b.name}{b.active ? '' : ' (oculto)'}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Otro">
                                <option value="o">Otro producto (escribir)...</option>
                              </optgroup>
                            </select>

                            {item.type === 'other' && (
                              <input
                                placeholder="Ej: Papas fritas"
                                value={item.name}
                                maxLength={40}
                                onChange={e => setItem(option.key, item.key, { name: e.target.value })}
                              />
                            )}
                          </div>

                          <span className="pm-component-price">
                            {item.type === 'other' ? (
                              <input
                                className="pm-unit-input"
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="Bs c/u"
                                value={item.unitPrice ?? ''}
                                onChange={e => setItem(option.key, item.key, { unitPrice: e.target.value })}
                              />
                            ) : (
                              <small>{money(unitPrice(item))} c/u</small>
                            )}
                            <b>= {money(unitPrice(item) * Number(item.qty || 0))}</b>
                          </span>

                          <button
                            className="icon-btn"
                            type="button"
                            title="Quitar"
                            onClick={() => removeItem(option.key, item.key)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pm-add-buttons">
                      <button className="mini" type="button" onClick={() => addItem(option.key)}>
                        <Plus size={13} /> Agregar producto
                      </button>
                    </div>

                    <div className="pm-option-foot">
                      <div>
                        <span>Precio normal</span>
                        <b>{money(normal)}</b>
                      </div>

                      <label>
                        <span>Precio promo (Bs)</span>
                        <input
                          className="pm-price-input"
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="0.00"
                          value={option.promoPrice}
                          onChange={e => setOption(option.key, { promoPrice: e.target.value })}
                        />
                      </label>

                      <div className={savings > 0 && promo > 0 ? 'pm-option-save good' : 'pm-option-save'}>
                        <span>Ahorro del cliente</span>
                        <b>
                          {promo > 0 && normal > 0
                            ? savings > 0
                              ? `${money(savings)} (${Math.round((savings / normal) * 100)}%)`
                              : 'Sin ahorro'
                            : '—'}
                        </b>
                      </div>
                    </div>

                    {optionErrors[oi] && (
                      <small className="pm-warning">{optionErrors[oi]}</small>
                    )}

                  </div>
                );
              })}
            </div>

            <div className="pm-add-buttons">
              <button className="mini pm-add-option" type="button" onClick={addOption}>
                <Plus size={13} /> Agregar opción
              </button>
            </div>
          </div>

          {/* vista previa de cómo se verá en el punto de venta */}
          <div className="pm-preview-label">Vista previa en el punto de venta</div>

          <div className="promo-group pm-preview">
            <div className="promo-group-head">
              {form.image ? (
                <img className="promo-group-image" src={form.image} alt="" />
              ) : (
                <span className="promo-card-emoji">{form.emoji}</span>
              )}
              <span className="promo-card-copy">
                <b>{form.title.trim() || 'Título de la promoción'}</b>
                {form.description.trim() && <em>{form.description.trim()}</em>}
              </span>
            </div>

            <div className="promo-group-options">
              {form.options.filter(o => o.active).map(option => (
                <div className="promo-option" key={option.key}>
                  <span className="promo-option-copy">
                    <b>{option.name.trim() || summary(option) || 'Opción'}</b>
                  </span>
                  <span className="promo-option-price">
                    <strong>{money(option.promoPrice)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="primary full big"
            type="button"
            disabled={!canSave || saving}
            onClick={savePromotion}
          >
            <Save size={17} />
            {saving ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear promoción'}
          </button>

        </section>

        {/* =================================================
            LISTA DE PROMOCIONES
        ================================================= */}

        <section className="panel pm-list">

          <div className="panel-title">
            <div>
              <span className="eyebrow">EN EL MENÚ</span>
              <h3>Promociones</h3>
            </div>
            <span className="count">{promotions.length} en total</span>
          </div>

          {!promotions.length ? (
            <div className="empty pm-empty">
              <Tag size={30} />
              <b>Aún no hay promociones</b>
              <span>Crea la primera con el formulario. Aparecerá al instante en el punto de venta.</span>
            </div>
          ) : (
            <div className="pm-items">
              {promotions.map((promo, index) => {
                const [statusClass, statusLabel] = promoStatus(promo);

                return (
                  <div
                    className={`pm-item pm-promo ${statusClass === 'live' ? '' : 'paused'} ${form.id === promo.id ? 'editing' : ''}`}
                    key={promo.id}
                    style={{ '--i': index }}
                  >
                    <div className="pm-promo-top">
                      {promo.image ? (
                        <img className="pm-item-image" src={promo.image} alt="" />
                      ) : (
                        <span className="pm-item-emoji">{promo.emoji}</span>
                      )}

                      <div className="pm-item-copy">
                        <b>
                          {promo.title}
                          <span className={`pm-badge ${statusClass}`}>{statusLabel}</span>
                        </b>
                        <span>
                          {promo.options.length} opci{promo.options.length === 1 ? 'ón' : 'ones'}
                          {(promo.startDate || promo.endDate) &&
                            ` · ${promo.startDate ? shortDate(promo.startDate) : '...'} al ${promo.endDate ? shortDate(promo.endDate) : '...'}`}
                        </span>
                      </div>

                      <div className="pm-item-actions">
                        <button className="mini" type="button" title="Editar" onClick={() => editPromotion(promo)}>
                          <Pencil size={13} />
                        </button>
                        <button
                          className="mini"
                          type="button"
                          title={promo.active ? 'Pausar' : 'Activar'}
                          onClick={() => togglePromotion(promo)}
                        >
                          {promo.active ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                        <button
                          className="mini danger"
                          type="button"
                          title="Eliminar"
                          onClick={() => deletePromotion(promo)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="pm-promo-options">
                      {promo.options.map(option => (
                        <div className={option.active ? 'pm-promo-option' : 'pm-promo-option off'} key={option.id}>
                          <button
                            type="button"
                            className={option.active ? 'pm-switch on' : 'pm-switch'}
                            title={option.active ? 'Clic para desactivar esta opción' : 'Clic para activar esta opción'}
                            onClick={() => toggleOption(promo, option)}
                          >
                            <i />
                          </button>
                          <span title={option.summary}>
                            {option.name}
                            {!option.available && <em> · producto no disponible</em>}
                          </span>
                          {option.savings > 0 && <s>{money(option.normalPrice)}</s>}
                          <b>{money(option.promoPrice)}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </section>

      </div>
      )}

      {/* =================================================
          SABORES
      ================================================= */}

      {tab === 'sabores' && (
        <div className="pm-catalog one" key="sabores">
          <CatalogPanel
            type="flavors"
            title="Sabores"
            eyebrow="PIZZAS"
            icon="🍕"
            items={catalog.flavors}
            hasPrice={false}
            onChange={afterChange}
            onError={text => flash(text, 'error')}
          />
        </div>
      )}

    </div>
  );
}


// =========================================================
// PANEL DE CATÁLOGO (sabores / refrescos / extras)
// =========================================================

function CatalogPanel({ type, title, eyebrow, icon, items, hasPrice, onChange, onError }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editing, setEditing] = useState(null);

  async function create(e) {
    e.preventDefault();
    if (!name.trim() || (hasPrice && price === '')) return;

    try {
      await api(`/api/admin/catalog/${type}`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), price: Number(price) })
      });
      setName('');
      setPrice('');
      await onChange(`"${name.trim()}" agregado a ${title.toLowerCase()}`);
    } catch (error) {
      onError(error.message);
    }
  }

  async function saveEdit() {
    try {
      await api(`/api/admin/catalog/${type}/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editing.name, price: Number(editing.price) })
      });
      setEditing(null);
      await onChange('Cambios guardados');
    } catch (error) {
      onError(error.message);
    }
  }

  async function toggle(item) {
    try {
      await api(`/api/admin/catalog/${type}/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active })
      });
      await onChange(item.active ? `"${item.name}" oculto del menú` : `"${item.name}" visible en el menú`);
    } catch (error) {
      onError(error.message);
    }
  }

  async function remove(item) {
    if (!confirm(`¿Eliminar "${item.name}"?`)) return;

    try {
      await api(`/api/admin/catalog/${type}/${item.id}`, { method: 'DELETE' });
      await onChange(`"${item.name}" eliminado`);
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <section className="panel pm-cat">
      <div className="panel-title">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{icon} {title}</h3>
        </div>
        <span className="count">{items.length}</span>
      </div>

      <div className="pm-cat-list">
        {items.map(item =>
          editing?.id === item.id ? (
            <div className="pm-cat-row editing" key={item.id}>
              <input
                value={editing.name}
                autoFocus
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && saveEdit()}
              />
              {hasPrice && (
                <input
                  className="pm-cat-price"
                  type="number"
                  min="0"
                  step="0.5"
                  value={editing.price}
                  onChange={e => setEditing({ ...editing, price: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                />
              )}
              <button className="mini" type="button" title="Guardar" onClick={saveEdit}>
                <Check size={13} />
              </button>
              <button className="mini" type="button" title="Cancelar" onClick={() => setEditing(null)}>
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className={item.active ? 'pm-cat-row' : 'pm-cat-row off'} key={item.id}>
              <button
                type="button"
                className={item.active ? 'pm-switch on' : 'pm-switch'}
                title={item.active ? 'Visible en el menú — clic para ocultar' : 'Oculto — clic para mostrar'}
                onClick={() => toggle(item)}
              >
                <i />
              </button>
              <span className="pm-cat-name">{item.name}</span>
              {hasPrice && <b>{money(item.price)}</b>}
              <button
                className="mini"
                type="button"
                title="Editar"
                onClick={() => setEditing({ id: item.id, name: item.name, price: item.price ?? '' })}
              >
                <Pencil size={12} />
              </button>
              <button className="mini danger" type="button" title="Eliminar" onClick={() => remove(item)}>
                <Trash2 size={12} />
              </button>
            </div>
          )
        )}
      </div>

      <form className="pm-cat-add" onSubmit={create}>
        <input
          placeholder={`Nuevo ${type === 'flavors' ? 'sabor' : type === 'beverages' ? 'refresco' : 'extra'}`}
          value={name}
          maxLength={50}
          onChange={e => setName(e.target.value)}
        />
        {hasPrice && (
          <input
            className="pm-cat-price"
            type="number"
            min="0"
            step="0.5"
            placeholder="Bs"
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
        )}
        <button
          className="mini pm-cat-add-btn"
          type="submit"
          disabled={!name.trim() || (hasPrice && price === '')}
        >
          <Plus size={14} />
        </button>
      </form>
    </section>
  );
}
