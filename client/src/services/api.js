// =========================================================
// URL DEL BACKEND
// Se define con la variable VITE_API_URL (client/.env.*).
// - Desarrollo:  VITE_API_URL=http://localhost:3002
// - Producción:  vacía → usa el mismo dominio de la página
//                (el servidor entrega web + API juntos), o
//                VITE_API_URL=https://api.tu-pizzeria.com
//                si la API está en otro dominio.
// =========================================================

export const API_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export async function api(path, options = {}) {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  let data = {};
  try { data = await response.json(); } catch {}

  if (!response.ok) {
    throw new Error(data.error || data.message || `Error ${response.status}`);
  }

  return data;
}
