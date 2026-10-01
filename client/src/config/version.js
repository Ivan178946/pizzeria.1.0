// =========================================================
// VERSIÓN DEL SISTEMA
// Se toma del package.json de la raíz del proyecto.
// Para publicar una versión nueva:
//   npm version minor   → 1.0.0 → 1.1.0 (mejoras)
//   npm version patch   → 1.1.0 → 1.1.1 (correcciones)
//   npm version major   → 1.1.1 → 2.0.0 (cambios grandes)
// y anota los cambios en CHANGELOG.md
// =========================================================

export const APP_VERSION = __APP_VERSION__;

export const APP_NAME = 'Pizzería KIKIS POS';

export const APP_FULL_NAME = `${APP_NAME} v${APP_VERSION}`;
