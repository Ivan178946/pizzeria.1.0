import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));


// =========================================================
// VARIABLES DE ENTORNO
// En desarrollo se leen de server/.env (copia .env.example).
// En producción las define el hosting (Railway, Render...).
// =========================================================

const envFile = path.join(__dirname, '../.env');

if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

export const PORT = Number(process.env.PORT || 3002);


// ---------------------------------------------------------
// Secreto de las sesiones: obligatorio en producción
// ---------------------------------------------------------

const DEV_JWT_SECRET = 'solo-para-desarrollo-local';

export const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;

if (IS_PRODUCTION && JWT_SECRET === DEV_JWT_SECRET) {
  throw new Error(
    'Falta la variable de entorno JWT_SECRET. Defínela en el hosting antes de iniciar en producción.'
  );
}


// ---------------------------------------------------------
// Base de datos SQLite
// En la nube debe apuntar a un disco persistente, por
// ejemplo /data/pizzeria.db en un volumen de Railway.
// ---------------------------------------------------------

export const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../pizzeria.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });


// ---------------------------------------------------------
// Contraseña inicial del administrador. Solo se usa la
// primera vez, cuando la base de datos está vacía.
// ---------------------------------------------------------

export const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'Admin123!';

if (IS_PRODUCTION && !process.env.ADMIN_INITIAL_PASSWORD) {
  console.warn(
    'Aviso: ADMIN_INITIAL_PASSWORD no está definida. Si la base de datos es nueva, el admin tendrá la contraseña por defecto: cámbiala al ingresar.'
  );
}


// ---------------------------------------------------------
// Dominios que pueden usar la API (CORS), separados por
// coma. Si el frontend se sirve desde este mismo servidor
// (despliegue recomendado) no hace falta agregar nada.
// ---------------------------------------------------------

export const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5177,http://127.0.0.1:5177'
)
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);


// Carpeta del frontend compilado (npm run build)
export const CLIENT_DIST = path.join(__dirname, '../../client/dist');


// Versión del sistema: se toma del package.json de la raíz
export const APP_VERSION = (() => {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
    ).version;
  } catch {
    return '0.0.0';
  }
})();
