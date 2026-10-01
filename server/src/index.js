import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';

import {
  APP_VERSION,
  CLIENT_DIST,
  CORS_ORIGINS,
  DB_PATH,
  IS_PRODUCTION,
  NODE_ENV,
  PORT
} from './config.js';
import './db.js';

import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import shiftRoutes from './routes/shifts.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import promotionRoutes from './routes/promotions.js';
import catalogRoutes from './routes/catalog.js';
import productRoutes from './routes/products.js';
import settingsRoutes from './routes/settings.js';

const app = express();

// Detrás del proxy HTTPS del hosting
app.set('trust proxy', 1);


// ==========================================
// CONFIGURACIÓN CORS
// Solo los dominios de CORS_ORIGINS pueden usar
// la API desde otro sitio. Las peticiones del
// mismo dominio (frontend servido aquí) no
// necesitan CORS.
// ==========================================

app.use(cors({
  origin(origin, callback) {
    if (!origin || CORS_ORIGINS.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }

    // En desarrollo se acepta cualquier localhost
    if (!IS_PRODUCTION && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    callback(null, false);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


// ==========================================
// JSON
// ==========================================

// Límite mayor para poder subir la imagen del QR y de las promociones
app.use(express.json({ limit: '8mb' }));


// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'pizzeria-pos',
    version: APP_VERSION,
    environment: NODE_ENV
  });
});


// ==========================================
// RUTAS
// ==========================================

app.use('/api', authRoutes);

app.use('/api/menu', menuRoutes);

app.use('/api/orders', orderRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/admin/shifts', shiftRoutes);

app.use('/api/admin/promotions', promotionRoutes);

app.use('/api/admin/catalog', catalogRoutes);

app.use('/api/admin/products', productRoutes);

app.use('/api/settings', settingsRoutes);


// ==========================================
// DASHBOARD
// ==========================================

app.use('/api/dashboard', dashboardRoutes);


// ==========================================
// RUTA DE API INEXISTENTE
// ==========================================

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada'
  });
});


// ==========================================
// FRONTEND COMPILADO
// En producción este mismo servidor entrega la
// página web (client/dist), así todo funciona
// con un solo dominio: https://tu-pizzeria.com
// ==========================================

const indexHtml = path.join(CLIENT_DIST, 'index.html');

if (fs.existsSync(indexHtml)) {
  app.use(express.static(CLIENT_DIST, {
    index: false,
    maxAge: IS_PRODUCTION ? '7d' : 0,
    setHeaders(res, file) {
      // index.html nunca se guarda en caché para que
      // cada versión nueva se vea al instante
      if (file.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}


// ==========================================
// MANEJO DE ERRORES
// ==========================================

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: IS_PRODUCTION
      ? 'Error interno del servidor'
      : err.message || 'Error interno del servidor'
  });
});


// ==========================================
// SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log(`Pizzeria KIKIS POS v${APP_VERSION} (${NODE_ENV})`);
  console.log(`API en el puerto ${PORT}`);
  console.log(`Base de datos: ${DB_PATH}`);

  if (fs.existsSync(indexHtml)) {
    console.log('Sirviendo también la página web (client/dist)');
  }
});
