import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { db } from '../db.js';
import { JWT_SECRET } from '../config.js';
import { auth } from '../middleware/auth.js';
import { log } from '../utils/audit.js';

const router = express.Router();

/* =========================================================
   LOGIN
   ========================================================= */

router.post('/login', (req, res) => {
  try {
    const username = String(
      req.body?.username || ''
    ).trim();

    const password = String(
      req.body?.password || ''
    );

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE username = ?
      `)
      .get(username);

    if (
      !user ||
      !user.active ||
      !bcrypt.compareSync(
        password,
        user.password_hash
      )
    ) {
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos'
      });
    }

    /* Crear nueva sesión */
    const sessionToken = crypto.randomUUID();

    db.prepare(`
      UPDATE users
      SET session_token = ?
      WHERE id = ?
    `).run(
      sessionToken,
      user.id
    );

    /* Crear JWT */
    const token = jwt.sign(
      {
        id: user.id,
        session_token: sessionToken
      },
      JWT_SECRET,
      {
        expiresIn: '12h'
      }
    );

    log(
      user.id,
      'LOGIN',
      `Inicio de sesión: ${user.username}`
    );

    return res.json({
      token,

      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    return res.status(500).json({
      error: 'Error interno al iniciar sesión'
    });
  }
});


/* =========================================================
   LOGOUT
   ========================================================= */

router.post('/logout', auth, (req, res) => {
  try {

    db.prepare(`
      UPDATE users
      SET session_token = NULL
      WHERE id = ?
    `).run(req.user.id);

    log(
      req.user.id,
      'LOGOUT',
      'Cierre de sesión'
    );

    return res.json({
      ok: true
    });

  } catch (error) {

    console.error('LOGOUT ERROR:', error);

    return res.status(500).json({
      error: 'Error al cerrar sesión'
    });
  }
});


/* =========================================================
   USUARIO ACTUAL
   ========================================================= */

router.get('/me', auth, (req, res) => {

  return res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      username: req.user.username,
      role: req.user.role
    }
  });

});


/* =========================================================
   EXPORTAR ROUTER
   ========================================================= */

export default router;