import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { JWT_SECRET } from '../config.js';

export function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(`
      SELECT id, name, username, role, active, session_token
      FROM users WHERE id = ?
    `).get(payload.id);

    if (!user || !user.active || user.session_token !== payload.session_token) {
      return res.status(401).json({ error: 'Sesión inválida o reemplazada por otro inicio de sesión' });
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'No autorizado' });
  }
}

export function admin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede realizar esta acción' });
  }
  next();
}
