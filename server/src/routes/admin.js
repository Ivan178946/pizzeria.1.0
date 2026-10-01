import express from 'express';
import bcrypt from 'bcryptjs';

import { db } from '../db.js';
import { auth, admin } from '../middleware/auth.js';
import { log } from '../utils/audit.js';

const router = express.Router();


// =========================================================
// LISTAR USUARIOS
// =========================================================

router.get('/users', auth, admin, (req, res) => {

  const users = db.prepare(`
    SELECT
      id,
      name,
      username,
      role,
      active,
      session_token IS NOT NULL AS online
    FROM users
    ORDER BY id DESC
  `).all();

  res.json(users);
});


// =========================================================
// CREAR USUARIO
// =========================================================

router.post('/users', auth, admin, (req, res) => {

  const name =
    String(req.body?.name || '').trim();

  const username =
    String(req.body?.username || '').trim();

  const password =
    String(req.body?.password || '');

  const role =
    req.body?.role === 'admin'
      ? 'admin'
      : 'cajero';


  // ---------------------------------------------------------
  // VALIDACIONES
  // ---------------------------------------------------------

  if (!name || !username || !password) {

    return res.status(400).json({
      error: 'Complete todos los campos'
    });
  }


  if (password.length < 6) {

    return res.status(400).json({
      error:
        'La contraseña debe tener al menos 6 caracteres'
    });
  }


  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {

    return res.status(400).json({
      error:
        'El usuario solo puede contener letras, números, punto, guion y guion bajo'
    });
  }


  // ---------------------------------------------------------
  // CREAR
  // ---------------------------------------------------------

  try {

    const result = db.prepare(`
      INSERT INTO users(
        name,
        username,
        password_hash,
        role
      )
      VALUES (?, ?, ?, ?)
    `).run(
      name,
      username,
      bcrypt.hashSync(password, 10),
      role
    );


    log(
      req.user.id,
      'CREATE_USER',
      username
    );


    res.status(201).json({
      ok: true,
      id: Number(
        result.lastInsertRowid
      )
    });

  } catch (error) {

    console.error(
      'Error creando usuario:',
      error
    );


    res.status(400).json({
      error:
        'El usuario ya existe o los datos son inválidos'
    });
  }
});


// =========================================================
// MODIFICAR USUARIO
// =========================================================
// El administrador puede modificar:
//
// - Nombre
// - Usuario
// - Contraseña
// - Estado activo/inactivo
//
// Los usuarios operativos pueden ser modificados.
// Otro administrador NO puede ser modificado.
// =========================================================

router.patch('/users/:id', auth, admin, (req, res) => {

  const id =
    Number(req.params.id);


  // ---------------------------------------------------------
  // BUSCAR USUARIO
  // ---------------------------------------------------------

  const user = db.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).get(id);


  if (!user) {

    return res.status(404).json({
      error:
        'Usuario no encontrado'
    });
  }


  // ---------------------------------------------------------
  // PROTEGER OTROS ADMINISTRADORES
  // ---------------------------------------------------------

  if (
    user.role === 'admin' &&
    id !== req.user.id
  ) {

    return res.status(400).json({
      error:
        'No se puede modificar otro administrador'
    });
  }


  // ---------------------------------------------------------
  // DATOS RECIBIDOS
  // ---------------------------------------------------------

  const name =
    req.body?.name !== undefined
      ? String(
          req.body.name
        ).trim()
      : null;


  const username =
    req.body?.username !== undefined
      ? String(
          req.body.username
        ).trim()
      : null;


  const active =
    req.body?.active !== undefined
      ? Number(
          req.body.active
        )
      : null;


  const password =
    req.body?.password !== undefined
      ? String(
          req.body.password
        )
      : '';


  // ---------------------------------------------------------
  // VALIDAR NOMBRE
  // ---------------------------------------------------------

  if (
    name !== null &&
    !name
  ) {

    return res.status(400).json({
      error:
        'El nombre no puede estar vacío'
    });
  }


  // ---------------------------------------------------------
  // VALIDAR USUARIO
  // ---------------------------------------------------------

  if (
    username !== null &&
    !username
  ) {

    return res.status(400).json({
      error:
        'El usuario no puede estar vacío'
    });
  }


  if (
    username !== null &&
    !/^[a-zA-Z0-9._-]+$/.test(
      username
    )
  ) {

    return res.status(400).json({
      error:
        'El usuario solo puede contener letras, números, punto, guion y guion bajo'
    });
  }


  // ---------------------------------------------------------
  // VALIDAR ESTADO
  // ---------------------------------------------------------

  if (
    active !== null &&
    active !== 0 &&
    active !== 1
  ) {

    return res.status(400).json({
      error:
        'Estado de usuario inválido'
    });
  }


  // ---------------------------------------------------------
  // VALIDAR CONTRASEÑA
  // ---------------------------------------------------------

  if (
    password &&
    password.length < 6
  ) {

    return res.status(400).json({
      error:
        'La contraseña debe tener al menos 6 caracteres'
    });
  }


  // ---------------------------------------------------------
  // PREPARAR CONTRASEÑA
  // ---------------------------------------------------------

  const passwordHash =
    password
      ? bcrypt.hashSync(
          password,
          10
        )
      : null;


  // ---------------------------------------------------------
  // ACTUALIZAR USUARIO
  // ---------------------------------------------------------

  try {

    db.prepare(`
      UPDATE users
      SET
        name =
          COALESCE(
            ?,
            name
          ),

        username =
          COALESCE(
            ?,
            username
          ),

        active =
          COALESCE(
            ?,
            active
          ),

        password_hash =
          COALESCE(
            ?,
            password_hash
          ),

        session_token =
          CASE
            WHEN ? = 0
              THEN NULL

            WHEN ? IS NOT NULL
              THEN NULL

            ELSE session_token
          END

      WHERE id = ?
    `).run(

      name,

      username,

      active,

      passwordHash,

      active === null
        ? null
        : active,

      passwordHash,

      id
    );


    // -------------------------------------------------------
    // AUDITORÍA
    // -------------------------------------------------------

    let changes = [];

    if (name !== null) {
      changes.push('nombre');
    }

    if (username !== null) {
      changes.push('usuario');
    }

    if (passwordHash !== null) {
      changes.push('contraseña');
    }

    if (active !== null) {
      changes.push(
        active === 1
          ? 'activado'
          : 'desactivado'
      );
    }


    log(
      req.user.id,
      'UPDATE_USER',
      `Usuario ${id} actualizado: ${changes.join(', ')}`
    );


    // -------------------------------------------------------
    // RESPUESTA
    // -------------------------------------------------------

    res.json({
      ok: true,
      message:
        'Usuario actualizado correctamente'
    });

  } catch (error) {

    console.error(
      'Error actualizando usuario:',
      error
    );


    // Usuario duplicado

    if (
      String(
        error.message || ''
      ).includes('UNIQUE')
    ) {

      return res.status(400).json({
        error:
          'Ese nombre de usuario ya existe'
      });
    }


    res.status(400).json({
      error:
        'No se pudo actualizar el usuario'
    });
  }
});


// =========================================================
// CAMBIAR MI PERFIL
// =========================================================
// Solo el administrador autenticado puede modificar:
//
// - Su propio nombre
// - Su propia contraseña
//
// Para cambiar contraseña se requiere:
//
// - Contraseña actual
// - Nueva contraseña
// - Confirmación
// =========================================================

router.patch(
  '/profile',
  auth,
  admin,
  (req, res) => {

    const name =
      String(
        req.body?.name || ''
      ).trim();


    const currentPassword =
      String(
        req.body?.currentPassword || ''
      );


    const newPassword =
      String(
        req.body?.newPassword || ''
      );


    const confirmPassword =
      String(
        req.body?.confirmPassword || ''
      );


    // -------------------------------------------------------
    // BUSCAR ADMINISTRADOR
    // -------------------------------------------------------

    const user = db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).get(req.user.id);


    if (!user) {

      return res.status(404).json({
        error:
          'Usuario no encontrado'
      });
    }


    // -------------------------------------------------------
    // VALIDAR NOMBRE
    // -------------------------------------------------------

    if (!name) {

      return res.status(400).json({
        error:
          'El nombre no puede estar vacío'
      });
    }


    // -------------------------------------------------------
    // ¿ESTÁ CAMBIANDO CONTRASEÑA?
    // -------------------------------------------------------

    const changingPassword =
      Boolean(
        currentPassword ||
        newPassword ||
        confirmPassword
      );


    if (changingPassword) {

      // Contraseña actual

      if (!currentPassword) {

        return res.status(400).json({
          error:
            'Ingresa tu contraseña actual'
        });
      }


      // Nueva contraseña

      if (!newPassword) {

        return res.status(400).json({
          error:
            'Ingresa la nueva contraseña'
        });
      }


      // Confirmación

      if (!confirmPassword) {

        return res.status(400).json({
          error:
            'Confirma la nueva contraseña'
        });
      }


      // -----------------------------------------------------
      // COMPROBAR CONTRASEÑA ACTUAL
      // -----------------------------------------------------

      const validCurrentPassword =
        bcrypt.compareSync(
          currentPassword,
          user.password_hash
        );


      if (!validCurrentPassword) {

        return res.status(400).json({
          error:
            'La contraseña actual es incorrecta'
        });
      }


      // -----------------------------------------------------
      // LONGITUD
      // -----------------------------------------------------

      if (
        newPassword.length < 6
      ) {

        return res.status(400).json({
          error:
            'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }


      // -----------------------------------------------------
      // CONFIRMACIÓN
      // -----------------------------------------------------

      if (
        newPassword !==
        confirmPassword
      ) {

        return res.status(400).json({
          error:
            'Las nuevas contraseñas no coinciden'
        });
      }
    }


    // -------------------------------------------------------
    // GUARDAR CAMBIOS
    // -------------------------------------------------------

    if (changingPassword) {

      const passwordHash =
        bcrypt.hashSync(
          newPassword,
          10
        );


      db.prepare(`
        UPDATE users
        SET
          name = ?,
          password_hash = ?,
          session_token = NULL
        WHERE id = ?
      `).run(
        name,
        passwordHash,
        req.user.id
      );

    } else {

      db.prepare(`
        UPDATE users
        SET
          name = ?
        WHERE id = ?
      `).run(
        name,
        req.user.id
      );
    }


    // -------------------------------------------------------
    // AUDITORÍA
    // -------------------------------------------------------

    log(
      req.user.id,
      'UPDATE_PROFILE',
      changingPassword
        ? 'Nombre y contraseña actualizados'
        : 'Nombre actualizado'
    );


    // -------------------------------------------------------
    // RESPUESTA
    // -------------------------------------------------------

    res.json({
      ok: true,

      passwordChanged:
        Boolean(
          changingPassword
        ),

      message:
        changingPassword
          ? 'Perfil y contraseña actualizados. Inicia sesión nuevamente.'
          : 'Nombre actualizado correctamente.'
    });
  }
);


// =========================================================
// ELIMINAR USUARIO
// =========================================================

router.delete(
  '/users/:id',
  auth,
  admin,
  (req, res) => {

    const id =
      Number(
        req.params.id
      );


    const user = db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).get(id);


    if (!user) {

      return res.status(404).json({
        error:
          'Usuario no encontrado'
      });
    }


    // No eliminar administradores

    if (
      user.role === 'admin'
    ) {

      return res.status(400).json({
        error:
          'No se puede eliminar un administrador'
      });
    }


    // No eliminarse a sí mismo

    if (
      id === req.user.id
    ) {

      return res.status(400).json({
        error:
          'No puede eliminar su propio usuario'
      });
    }


    db.prepare(
      'DELETE FROM users WHERE id = ?'
    ).run(id);


    log(
      req.user.id,
      'DELETE_USER',
      user.username
    );


    res.json({
      ok: true
    });
  }
);


// =========================================================
// RESUMEN ADMINISTRATIVO
// =========================================================

router.get(
  '/summary',
  auth,
  admin,
  (req, res) => {

    const summary =
      db.prepare(`
        SELECT
          COUNT(*) AS orders,

          COALESCE(
            SUM(total),
            0
          ) AS total,

          COALESCE(
            SUM(cash),
            0
          ) AS cash,

          COALESCE(
            SUM(qr),
            0
          ) AS qr

        FROM orders

        WHERE date(created_at) =
              date(
                'now',
                'localtime'
              )
      `).get();


    const users =
      db.prepare(`
        SELECT
          COUNT(*) AS c

        FROM users

        WHERE active = 1
      `).get().c;


    res.json({
      ...summary,
      users
    });
  }
);


// =========================================================
// EXPORTAR
// =========================================================

export default router;