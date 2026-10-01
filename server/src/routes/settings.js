import express from 'express';

import { db } from '../db.js';
import { auth, admin } from '../middleware/auth.js';
import { log } from '../utils/audit.js';

const router = express.Router();

const MAX_QR_LENGTH = 3_000_000; // ~2 MB en base64


// =========================================================
// CONFIGURACIÓN DE PAGO POR QR
// =========================================================

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings(key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function paymentSettings() {
  return {
    qrEnabled: getSetting('qr_enabled') !== '0',
    qrImage: getSetting('qr_image') || '',
    qrUpdatedAt: getSetting('qr_updated_at') || ''
  };
}


// Cualquier usuario: el cajero necesita ver el QR
router.get('/payment', auth, (req, res) => {
  res.json(paymentSettings());
});


// Solo administrador: subir, cambiar, eliminar, activar
router.patch('/payment', auth, admin, (req, res) => {
  try {
    const body = req.body || {};
    const changes = [];

    if ('qrImage' in body) {
      const image = String(body.qrImage || '');

      if (image && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image)) {
        throw new Error('El QR debe ser una imagen PNG, JPG, WEBP o GIF');
      }

      if (image.length > MAX_QR_LENGTH) {
        throw new Error('La imagen del QR es demasiado pesada (máximo 2 MB)');
      }

      setSetting('qr_image', image);
      setSetting('qr_updated_at', new Date().toISOString());
      changes.push(image ? 'QR actualizado' : 'QR eliminado');
    }

    if ('qrEnabled' in body) {
      setSetting('qr_enabled', body.qrEnabled ? '1' : '0');
      changes.push(body.qrEnabled ? 'pago QR activado' : 'pago QR desactivado');
    }

    if (changes.length) {
      log(req.user.id, 'PAYMENT_SETTINGS', changes.join(', '));
    }

    res.json(paymentSettings());

  } catch (error) {
    res.status(400).json({
      error: error.message || 'No se pudo guardar la configuración de pago'
    });
  }
});

export default router;
