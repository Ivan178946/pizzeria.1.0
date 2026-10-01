import { db } from '../db.js';

export function log(userId, action, details = '') {
  db.prepare(`
    INSERT INTO audit(user_id, action, details)
    VALUES (?, ?, ?)
  `).run(userId, action, details);
}
