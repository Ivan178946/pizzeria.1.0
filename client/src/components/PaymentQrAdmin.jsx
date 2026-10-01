import { useEffect, useRef, useState } from 'react';

import {
  Check,
  ImageUp,
  QrCode,
  RefreshCw,
  Save,
  Trash2,
  X
} from 'lucide-react';

import { api } from '../services/api.js';
import { readImage } from '../utils/image.js';

// =========================================================
// MÉTODOS DE PAGO — QR CONFIGURABLE (SOLO ADMINISTRADOR)
// =========================================================

export default function PaymentQrAdmin({ onSaved }) {
  const [settings, setSettings] = useState({ qrEnabled: true, qrImage: '' });
  const [draft, setDraft] = useState(null); // imagen elegida aún sin guardar
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api('/api/settings/payment')
      .then(data => setSettings(data))
      .catch(error => flash(error.message, 'error'));
  }, []);

  function flash(text, type = 'success') {
    setNotice({ text, type });
    setTimeout(() => setNotice(n => (n?.text === text ? null : n)), 3500);
  }

  async function save(patch, text) {
    try {
      setSaving(true);

      const data = await api('/api/settings/payment', {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });

      setSettings(data);
      setDraft(null);
      flash(text);
      onSaved?.();

    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function chooseFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    try {
      setDraft(await readImage(file, { maxSize: 900, keepPng: true }));
    } catch (error) {
      flash(error.message, 'error');
    }
  }

  function removeQr() {
    if (!confirm('¿Eliminar el QR de pago?\n\nEl cajero ya no podrá mostrarlo al cliente.')) return;
    save({ qrImage: '' }, 'QR eliminado');
  }

  const preview = draft || settings.qrImage;

  return (
    <section className="panel qr-admin">

      {notice && (
        <div className={`pm-notice ${notice.type}`}>
          {notice.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {notice.text}
        </div>
      )}

      <div className="panel-title">
        <div>
          <span className="eyebrow">MÉTODOS DE PAGO</span>
          <h3>Pago por QR</h3>
        </div>

        <div className="qr-admin-switch">
          <span>{settings.qrEnabled ? 'Activado' : 'Desactivado'}</span>
          <button
            type="button"
            className={settings.qrEnabled ? 'pm-switch on' : 'pm-switch'}
            title={settings.qrEnabled ? 'Clic para desactivar el pago por QR' : 'Clic para activar el pago por QR'}
            disabled={saving}
            onClick={() =>
              save(
                { qrEnabled: !settings.qrEnabled },
                settings.qrEnabled ? 'Pago por QR desactivado' : 'Pago por QR activado'
              )
            }
          >
            <i />
          </button>
        </div>
      </div>

      <div className="qr-admin-body">

        <div className={preview ? 'qr-admin-preview' : 'qr-admin-preview empty'}>
          {preview ? (
            <img src={preview} alt="QR de pago" />
          ) : (
            <>
              <QrCode size={44} />
              <span>Sin QR cargado</span>
            </>
          )}
          {draft && <em>Vista previa — sin guardar</em>}
        </div>

        <div className="qr-admin-copy">
          <p>
            Sube la imagen del QR de tu banco o billetera. Se mostrará en el
            punto de venta cuando el cajero elija <b>QR</b> o <b>Mixto</b> como
            método de pago.
          </p>

          {!settings.qrEnabled && (
            <p className="qr-admin-warning">
              El pago por QR está desactivado: en el punto de venta solo se podrá cobrar en efectivo.
            </p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={chooseFile}
          />

          <div className="qr-admin-actions">
            <button className="mini" type="button" onClick={() => fileRef.current?.click()} disabled={saving}>
              {settings.qrImage ? <RefreshCw size={14} /> : <ImageUp size={14} />}
              {settings.qrImage ? 'Cambiar QR' : 'Subir QR'}
            </button>

            {draft && (
              <>
                <button
                  className="primary"
                  type="button"
                  disabled={saving}
                  onClick={() => save({ qrImage: draft }, 'QR guardado. Ya está disponible en el punto de venta')}
                >
                  <Save size={15} />
                  {saving ? 'Guardando...' : 'Guardar QR'}
                </button>

                <button className="mini" type="button" onClick={() => setDraft(null)} disabled={saving}>
                  <X size={14} /> Descartar
                </button>
              </>
            )}

            {!draft && settings.qrImage && (
              <button className="mini danger" type="button" onClick={removeQr} disabled={saving}>
                <Trash2 size={14} /> Eliminar QR
              </button>
            )}
          </div>
        </div>

      </div>

    </section>
  );
}
