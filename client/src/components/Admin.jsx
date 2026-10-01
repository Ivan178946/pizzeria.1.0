import { useState } from 'react';

import {
  Plus,
  Trash2,
  RefreshCw,
  Users,
  ShieldCheck,
  LockKeyhole,
  UserRound,
  Save,
  KeyRound,
  Pencil,
  X
} from 'lucide-react';

import { api } from '../services/api.js';
import PaymentQrAdmin from './PaymentQrAdmin.jsx';


export default function Admin({ users, reload }) {

  // =========================================================
  // CREAR USUARIO
  // =========================================================

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');


  // =========================================================
  // PERFIL DEL ADMINISTRADOR
  // =========================================================

  const currentUser =
    users.find(user => user.role === 'admin');

  const [profileName, setProfileName] =
    useState('');

  const [currentPassword, setCurrentPassword] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [profileMessage, setProfileMessage] =
    useState('');

  const [savingProfile, setSavingProfile] =
    useState(false);


  // =========================================================
  // EDITAR USUARIO OPERATIVO
  // =========================================================

  const [editingUser, setEditingUser] =
    useState(null);

  const [editName, setEditName] =
    useState('');

  const [editUsername, setEditUsername] =
    useState('');

  const [editPassword, setEditPassword] =
    useState('');

  const [savingUser, setSavingUser] =
    useState(false);


  // =========================================================
  // CREAR USUARIO
  // =========================================================

  async function create() {

    if (
      !name.trim() ||
      !username.trim() ||
      !password
    ) {
      alert('Complete todos los campos.');
      return;
    }

    try {

      await api(
        '/api/admin/users',
        {
          method: 'POST',

          body: JSON.stringify({
            name: name.trim(),
            username: username.trim(),
            password
          })
        }
      );

      setName('');
      setUsername('');
      setPassword('');

      reload();

    } catch (error) {

      alert(error.message);
    }
  }


  // =========================================================
  // ACTIVAR / DESACTIVAR
  // =========================================================

  async function toggle(user) {

    // El administrador no debe desactivarse
    if (user.role === 'admin') {
      alert(
        'El administrador principal no puede desactivarse desde aquí.'
      );
      return;
    }

    try {

      await api(
        `/api/admin/users/${user.id}`,
        {
          method: 'PATCH',

          body: JSON.stringify({
            active:
              user.active
                ? 0
                : 1
          })
        }
      );

      reload();

    } catch (error) {

      alert(error.message);
    }
  }


  // =========================================================
  // ELIMINAR
  // =========================================================

  async function remove(user) {

    if (user.role === 'admin') {
      alert(
        'No se puede eliminar un administrador.'
      );
      return;
    }

    if (
      !confirm(
        `¿Eliminar usuario ${user.name}?`
      )
    ) {
      return;
    }

    try {

      await api(
        `/api/admin/users/${user.id}`,
        {
          method: 'DELETE'
        }
      );

      reload();

    } catch (error) {

      alert(error.message);
    }
  }


  // =========================================================
  // ABRIR EDICIÓN
  // =========================================================

  function openEdit(user) {

    // Solo usuarios operativos
    if (user.role === 'admin') {
      alert(
        'El administrador principal se modifica desde Mi Perfil.'
      );
      return;
    }

    setEditingUser(user);

    setEditName(
      user.name || ''
    );

    setEditUsername(
      user.username || ''
    );

    setEditPassword('');
  }


  // =========================================================
  // CERRAR EDICIÓN
  // =========================================================

  function closeEdit() {

    setEditingUser(null);

    setEditName('');
    setEditUsername('');
    setEditPassword('');
  }


  // =========================================================
  // GUARDAR USUARIO EDITADO
  // =========================================================

  async function saveUser() {

    if (!editingUser) {
      return;
    }

    if (!editName.trim()) {

      alert(
        'El nombre no puede estar vacío.'
      );

      return;
    }

    try {

      setSavingUser(true);

      const body = {
        name: editName.trim(),
        username: editUsername.trim()
      };

      // Solo cambiar contraseña si se escribió una
      if (editPassword) {

        if (editPassword.length < 6) {

          alert(
            'La contraseña debe tener al menos 6 caracteres.'
          );

          setSavingUser(false);
          return;
        }

        body.password = editPassword;
      }

      await api(
        `/api/admin/users/${editingUser.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body)
        }
      );

      alert(
        'Usuario actualizado correctamente.'
      );

      closeEdit();

      reload();

    } catch (error) {

      alert(
        `Error: ${error.message}`
      );

    } finally {

      setSavingUser(false);
    }
  }


  // =========================================================
  // CARGAR DATOS DEL PERFIL
  // =========================================================

  function startProfile() {

    setProfileName(
      currentUser?.name || ''
    );

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setProfileMessage('');
  }


  // =========================================================
  // GUARDAR PERFIL
  // =========================================================

  async function saveProfile() {

    if (!profileName.trim()) {

      setProfileMessage(
        'Ingresa tu nombre.'
      );

      return;
    }

    const changingPassword =
      currentPassword ||
      newPassword ||
      confirmPassword;


    if (changingPassword) {

      if (!currentPassword) {

        setProfileMessage(
          'Ingresa tu contraseña actual.'
        );

        return;
      }

      if (!newPassword) {

        setProfileMessage(
          'Ingresa la nueva contraseña.'
        );

        return;
      }

      if (!confirmPassword) {

        setProfileMessage(
          'Confirma la nueva contraseña.'
        );

        return;
      }

      if (newPassword.length < 6) {

        setProfileMessage(
          'La nueva contraseña debe tener al menos 6 caracteres.'
        );

        return;
      }

      if (
        newPassword !==
        confirmPassword
      ) {

        setProfileMessage(
          'Las nuevas contraseñas no coinciden.'
        );

        return;
      }
    }


    try {

      setSavingProfile(true);
      setProfileMessage('');


      const result = await api(
        '/api/admin/profile',
        {
          method: 'PATCH',

          body: JSON.stringify({
            name: profileName.trim(),
            currentPassword,
            newPassword,
            confirmPassword
          })
        }
      );


      if (result.passwordChanged) {

        alert(
          'Tu contraseña fue cambiada correctamente. Debes iniciar sesión nuevamente.'
        );

        localStorage.removeItem(
          'token'
        );

        window.location.reload();

        return;
      }


      setProfileMessage(
        '✓ Nombre actualizado correctamente.'
      );

      reload();

    } catch (error) {

      setProfileMessage(
        `Error: ${error.message}`
      );

    } finally {

      setSavingProfile(false);
    }
  }


  // =========================================================
  // ESTADÍSTICAS
  // =========================================================

  const activeUsers =
    users.filter(
      user => user.active
    ).length;

  const onlineUsers =
    users.filter(
      user => user.online
    ).length;


  // =========================================================
  // INTERFAZ
  // =========================================================

  return (

    <div className="admin">


      {/* =====================================================
          ESTADÍSTICAS
      ===================================================== */}

      <div className="stats">

        <div>

          <span>
            Usuarios activos
          </span>

          <b>
            {activeUsers}
          </b>

          <Users />

        </div>


        <div>

          <span>
            Sesiones activas
          </span>

          <b>
            {onlineUsers}
          </b>

          <ShieldCheck />

        </div>


        <div>

          <span>
            Control
          </span>

          <b>
            100%
          </b>

          <LockKeyhole />

        </div>

      </div>


      {/* =====================================================
          MÉTODOS DE PAGO — QR
      ===================================================== */}

      <PaymentQrAdmin onSaved={reload} />


      {/* =====================================================
          MI PERFIL
      ===================================================== */}

      <section className="panel profile-panel">

        <div className="panel-title">

          <div>

            <span className="eyebrow">
              MI PERFIL
            </span>

            <h3>
              Datos del administrador
            </h3>

          </div>

          <div className="profile-icon">
            <UserRound size={22} />
          </div>

        </div>


        <div className="profile-grid">

          <div className="profile-field">

            <label>
              Nombre
            </label>

            <input
              type="text"
              placeholder="Nombre del administrador"
              value={
                profileName ||
                currentUser?.name ||
                ''
              }
              onChange={e =>
                setProfileName(
                  e.target.value
                )
              }
            />

          </div>


          <div className="profile-field">

            <label>
              Usuario
            </label>

            <input
              type="text"
              value={
                currentUser?.username ||
                'admin'
              }
              disabled
            />

          </div>

        </div>


        <div className="password-section">

          <div className="password-title">

            <KeyRound size={18} />

            <div>

              <b>
                Cambiar contraseña
              </b>

              <span>
                Déjala vacía si no deseas cambiarla.
              </span>

            </div>

          </div>


          <div className="profile-grid">

            <div className="profile-field">

              <label>
                Contraseña actual
              </label>

              <input
                type="password"
                placeholder="Contraseña actual"
                value={currentPassword}
                onChange={e =>
                  setCurrentPassword(
                    e.target.value
                  )
                }
              />

            </div>


            <div className="profile-field">

              <label>
                Nueva contraseña
              </label>

              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={e =>
                  setNewPassword(
                    e.target.value
                  )
                }
              />

            </div>


            <div className="profile-field">

              <label>
                Confirmar contraseña
              </label>

              <input
                type="password"
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={e =>
                  setConfirmPassword(
                    e.target.value
                  )
                }
              />

            </div>

          </div>

        </div>


        {profileMessage && (

          <div
            className={
              profileMessage.startsWith('Error')
                ? 'profile-message error'
                : 'profile-message'
            }
          >
            {profileMessage}
          </div>

        )}


        <div className="profile-actions">

          <button
            className="primary"
            type="button"
            disabled={savingProfile}
            onClick={saveProfile}
          >

            <Save size={17} />

            {savingProfile
              ? 'Guardando...'
              : 'Guardar cambios'}

          </button>

        </div>

      </section>


      {/* =====================================================
          USUARIOS
      ===================================================== */}

      <section className="panel">

        <div className="panel-title">

          <div>

            <span className="eyebrow">
              ACCESOS
            </span>

            <h3>
              Usuarios del sistema
            </h3>

          </div>


          <button
            className="mini"
            type="button"
            onClick={reload}
          >

            <RefreshCw size={15} />

          </button>

        </div>


        <div className="table">

          {users.map(user => (

            <div
              className="row"
              key={user.id}
            >

              <div className="avatar sm">

                {user.name
                  ?.charAt(0)
                  ?.toUpperCase() ||
                  'U'}

              </div>


              <div>

                <b>
                  {user.name}
                </b>

                <span>
                  @{user.username}
                  {' • '}
                  {user.role === 'admin'
                    ? 'Administrador'
                    : 'Usuario operativo'}
                </span>

              </div>


              <span
                className={
                  user.online
                    ? 'status on'
                    : 'status'
                }
              >

                {user.online
                  ? 'En línea'
                  : 'Desconectado'}

              </span>


              {/* ==========================================
                  EDITAR
              ========================================== */}

              {user.role !== 'admin' && (

                <button
                  className="mini"
                  type="button"
                  onClick={() =>
                    openEdit(user)
                  }
                >

                  <Pencil size={13} />

                  Editar

                </button>

              )}


              {/* ==========================================
                  ACTIVAR / DESACTIVAR
              ========================================== */}

              {user.role !== 'admin' && (

                <button
                  className="mini"
                  type="button"
                  onClick={() =>
                    toggle(user)
                  }
                >

                  {user.active
                    ? 'Desactivar'
                    : 'Activar'}

                </button>

              )}


              {/* ==========================================
                  ELIMINAR
              ========================================== */}

              {user.role !== 'admin' && (

                <button
                  className="mini danger"
                  type="button"
                  onClick={() =>
                    remove(user)
                  }
                >

                  <Trash2 size={13} />

                  Eliminar

                </button>

              )}

            </div>

          ))}

        </div>

      </section>


      {/* =====================================================
          CREAR USUARIO
      ===================================================== */}

      <section className="panel create">

        <span className="eyebrow">
          NUEVO ACCESO
        </span>

        <h3>
          Crear usuario operativo
        </h3>

        <p>
          Puede vender y cerrar jornada,
          pero no eliminar ventas ni
          modificar la administración.
        </p>


        <input
          placeholder="Nombre completo"
          value={name}
          onChange={e =>
            setName(e.target.value)
          }
        />


        <input
          placeholder="Usuario"
          value={username}
          onChange={e =>
            setUsername(e.target.value)
          }
        />


        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e =>
            setPassword(e.target.value)
          }
        />


        <button
          className="primary full"
          type="button"
          disabled={
            !name.trim() ||
            !username.trim() ||
            !password
          }
          onClick={create}
        >

          <Plus size={17} />

          Crear usuario

        </button>

      </section>


      {/* =====================================================
          MODAL EDITAR USUARIO
      ===================================================== */}

      {editingUser && (

        <div className="modal-backdrop">

          <div className="modal edit-user-modal">

            <button
              className="modal-close"
              type="button"
              onClick={closeEdit}
            >

              <X size={22} />

            </button>


            <span className="eyebrow">
              ADMINISTRACIÓN
            </span>

            <h2>
              Editar usuario
            </h2>

            <p>
              Modifica los datos del usuario
              operativo seleccionado.
            </p>


            <div className="edit-user-form">

              <label>

                Nombre completo

                <input
                  type="text"
                  value={editName}
                  onChange={e =>
                    setEditName(
                      e.target.value
                    )
                  }
                />

              </label>


              <label>

                Usuario

                <input
                  type="text"
                  value={editUsername}
                  onChange={e =>
                    setEditUsername(e.target.value)
                  }
                />

              </label>


              <label>

                Nueva contraseña

                <input
                  type="password"
                  placeholder="Dejar vacío para mantenerla"
                  value={editPassword}
                  onChange={e =>
                    setEditPassword(
                      e.target.value
                    )
                  }
                />

              </label>


              <div className="edit-user-note">

                <KeyRound size={16} />

                <span>
                  Si no escribes una nueva
                  contraseña, se conservará la
                  contraseña actual.
                </span>

              </div>


              <div className="edit-user-actions">

                <button
                  className="secondary-button"
                  type="button"
                  onClick={closeEdit}
                >

                  Cancelar

                </button>


                <button
                  className="primary"
                  type="button"
                  disabled={savingUser}
                  onClick={saveUser}
                >

                  <Save size={17} />

                  {savingUser
                    ? 'Guardando...'
                    : 'Guardar cambios'}

                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}