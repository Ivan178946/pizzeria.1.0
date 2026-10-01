import { useEffect, useState } from 'react';

import {
  Minus,
  Plus,
  RotateCcw,
  Save,
  Trash2
} from 'lucide-react';

import { api } from '../services/api.js';
import { money } from '../utils/format.js';

// =========================================================
// EDITOR DE PRODUCTOS Y PRECIOS (SOLO ADMINISTRADOR)
// Cada producto tiene su lista de tamaños con precio.
// =========================================================

export const KIND_INFO = {
  individual: {
    label: 'Pizza individual',
    help: 'El cliente elige tamaño, 1 o 2 sabores y extras.',
    emoji: '🍕'
  },
  double: {
    label: 'Dos pizzas',
    help: 'Dos pizzas del mismo tamaño, cada una con su sabor.',
    emoji: '🍕🍕'
  },
  combo: {
    label: 'Pizza + gaseosa',
    help: 'Una pizza de un sabor con gaseosa incluida.',
    emoji: '🥤'
  }
};

function toDraft(product) {
  return {
    name: product.name,
    description: product.description || '',
    sizes: (product.sizes || []).map(s => ({ name: s.name, price: String(s.price) }))
  };
}

export default function ProductsAdmin({ products, onChange, onError }) {
  return (
    <div className="pp-wrap">

      <div className="pp-grid">
        {products.map((product, index) => (
          <ProductEditor
            key={product.id}
            product={product}
            index={index}
            onChange={onChange}
            onError={onError}
          />
        ))}
      </div>

      <NewProduct onChange={onChange} onError={onError} />

    </div>
  );
}


// =========================================================
// TARJETA DE UN PRODUCTO
// =========================================================

function ProductEditor({ product, index, onChange, onError }) {
  const [draft, setDraft] = useState(() => toDraft(product));
  const [adjust, setAdjust] = useState('5');
  const [saving, setSaving] = useState(false);

  // Cuando llegan datos nuevos del servidor, se descarta el borrador
  const serverKey = JSON.stringify(toDraft(product));

  useEffect(() => {
    setDraft(toDraft(product));
  }, [serverKey]);

  const dirty = JSON.stringify(draft) !== serverKey;
  const info = KIND_INFO[product.kind] || KIND_INFO.individual;

  function setSize(i, patch) {
    setDraft(d => ({
      ...d,
      sizes: d.sizes.map((s, j) => (j === i ? { ...s, ...patch } : s))
    }));
  }

  function addSize() {
    setDraft(d => ({ ...d, sizes: [...d.sizes, { name: '', price: '' }] }));
  }

  function removeSize(i) {
    setDraft(d => ({ ...d, sizes: d.sizes.filter((_, j) => j !== i) }));
  }

  // Sube o baja todos los precios a la vez (no guarda todavía)
  function adjustAll(sign) {
    const amount = Number(adjust);
    if (!Number.isFinite(amount) || amount <= 0) return;

    setDraft(d => ({
      ...d,
      sizes: d.sizes.map(s => {
        const next = Math.max(0.5, Number(s.price || 0) + sign * amount);
        return { ...s, price: String(Number(next.toFixed(2))) };
      })
    }));
  }

  async function save() {
    try {
      setSaving(true);

      await api(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name.trim(),
          description: draft.description.trim(),
          sizes: draft.sizes.map(s => ({ name: s.name.trim(), price: Number(s.price) }))
        })
      });

      await onChange(`Precios de "${draft.name.trim()}" guardados`);
    } catch (error) {
      onError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle() {
    try {
      await api(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !product.active })
      });

      await onChange(
        product.active
          ? `"${product.name}" oculto del punto de venta`
          : `"${product.name}" visible en el punto de venta`
      );
    } catch (error) {
      onError(error.message);
    }
  }

  async function remove() {
    if (!confirm(`¿Eliminar "${product.name}" del menú?\n\nLas ventas ya registradas no se modifican. Si solo quieres ocultarlo por un tiempo, usa el interruptor.`)) {
      return;
    }

    try {
      await api(`/api/admin/products/${product.id}`, { method: 'DELETE' });
      await onChange(`"${product.name}" eliminado`);
    } catch (error) {
      onError(error.message);
    }
  }

  // Resalta los precios que cambiaron respecto a lo guardado
  const original = new Map((product.sizes || []).map(s => [s.name, Number(s.price)]));

  return (
    <section
      className={`panel pp-card ${product.active ? '' : 'off'} ${dirty ? 'dirty' : ''}`}
      style={{ '--i': index }}
    >

      <div className="pp-head">
        <span className="pp-emoji">{info.emoji}</span>

        <div className="pp-head-copy">
          <span className="eyebrow">{info.label.toUpperCase()}</span>
          <input
            className="pp-name"
            value={draft.name}
            maxLength={50}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
        </div>

        <button
          type="button"
          className={product.active ? 'pm-switch on' : 'pm-switch'}
          title={product.active ? 'Visible en el punto de venta — clic para ocultar' : 'Oculto — clic para mostrar'}
          onClick={toggle}
        >
          <i />
        </button>
      </div>

      <input
        className="pp-desc"
        placeholder="Descripción que ve el cajero"
        value={draft.description}
        onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
      />

      <div className="pp-sizes">
        <div className="pp-sizes-head">
          <span>Tamaño</span>
          <span>Precio (Bs)</span>
        </div>

        {draft.sizes.map((size, i) => {
          const before = original.get(size.name.trim());
          const changed = before !== undefined && Number(size.price) !== before;

          return (
            <div className="pp-size" key={i}>
              <input
                value={size.name}
                placeholder="Ej: Mediana"
                maxLength={30}
                onChange={e => setSize(i, { name: e.target.value })}
              />

              <div className={changed ? 'pp-price changed' : 'pp-price'}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={size.price}
                  onChange={e => setSize(i, { price: e.target.value })}
                />
                {changed && <small>antes {money(before)}</small>}
              </div>

              <button
                className="icon-btn"
                type="button"
                title="Quitar tamaño"
                disabled={draft.sizes.length === 1}
                onClick={() => removeSize(i)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        <button className="mini pp-add-size" type="button" onClick={addSize}>
          <Plus size={13} /> Agregar tamaño
        </button>
      </div>

      <div className="pp-adjust">
        <span>Ajustar todos los precios</span>
        <div>
          <button className="mini" type="button" title="Bajar todos" onClick={() => adjustAll(-1)}>
            <Minus size={13} />
          </button>
          <input
            type="number"
            min="0"
            step="0.5"
            value={adjust}
            onChange={e => setAdjust(e.target.value)}
          />
          <button className="mini" type="button" title="Subir todos" onClick={() => adjustAll(1)}>
            <Plus size={13} />
          </button>
          <small>Bs</small>
        </div>
      </div>

      <div className="pp-actions">
        <button className="mini danger" type="button" onClick={remove}>
          <Trash2 size={13} /> Eliminar
        </button>

        {dirty && (
          <button className="mini" type="button" onClick={() => setDraft(toDraft(product))}>
            <RotateCcw size={13} /> Deshacer
          </button>
        )}

        <button
          className="primary pp-save"
          type="button"
          disabled={!dirty || saving}
          onClick={save}
        >
          <Save size={15} />
          {saving ? 'Guardando...' : dirty ? 'Guardar precios' : 'Sin cambios'}
        </button>
      </div>

    </section>
  );
}


// =========================================================
// AGREGAR UN PRODUCTO NUEVO
// =========================================================

function NewProduct({ onChange, onError }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('individual');
  const [saving, setSaving] = useState(false);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);

      await api('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: description.trim(), kind })
      });

      setName('');
      setDescription('');

      await onChange(`"${name.trim()}" agregado. Ajusta sus precios en su tarjeta.`);
    } catch (error) {
      onError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel pp-new" onSubmit={create}>
      <div>
        <span className="eyebrow">NUEVO PRODUCTO</span>
        <h3>Agregar pizza al menú</h3>
        <p>Se crea con los tamaños y precios de siempre; luego los ajustas.</p>
      </div>

      <div className="pp-kinds">
        {Object.entries(KIND_INFO).map(([key, info]) => (
          <button
            key={key}
            type="button"
            className={kind === key ? 'active' : ''}
            onClick={() => setKind(key)}
          >
            <span>{info.emoji}</span>
            <b>{info.label}</b>
            <small>{info.help}</small>
          </button>
        ))}
      </div>

      <div className="pp-new-fields">
        <input
          placeholder="Nombre. Ej: Pizza Especial de la Casa"
          value={name}
          maxLength={50}
          onChange={e => setName(e.target.value)}
        />
        <input
          placeholder="Descripción (opcional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <button className="primary" type="submit" disabled={!name.trim() || saving}>
          <Plus size={16} /> Agregar
        </button>
      </div>
    </form>
  );
}
