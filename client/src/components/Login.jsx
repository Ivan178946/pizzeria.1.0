import { useState } from 'react';
import {
  LogIn,
  Lock,
  UserRound,
  ShieldCheck,
  ChefHat
} from 'lucide-react';

import SpinningPizza from './SpinningPizza.jsx';
import { APP_VERSION } from '../config/version.js';

const logoKikis = '/logo.jpeg';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    if (!username.trim()) {
      setError('Ingresa tu usuario.');
      return;
    }

    if (!password) {
      setError('Ingresa tu contraseña.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await onLogin({
        username: username.trim(),
        password
      });
    } catch (err) {
      setError(
        err?.message ||
        'Usuario o contraseña incorrectos.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">

      {/* Fondo animado */}
      <div className="login-bg" aria-hidden="true">
        <span className="login-orb orb-1" />
        <span className="login-orb orb-2" />
        <span className="login-orb orb-3" />
        {['🍕', '🍅', '🌿', '🧀', '🍄', '🌶️'].map((emoji, i) => (
          <span
            key={i}
            className="login-float"
            style={{ '--i': i }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="login-shell">

        {/* PANEL DE MARCA */}
        <section className="login-hero">

          <div className="login-hero-brand">
            <img src={logoKikis} alt="Pizzería KIKIS" />
            <div>
              <span>PIZZERÍA</span>
              <strong>KIKIS</strong>
            </div>
          </div>

          <div className="login-hero-pizza">
            <SpinningPizza />
          </div>

          <div className="login-hero-copy">
            <h2>
              Cada pedido,<br />
              <em>perfectamente</em> horneado.
            </h2>
            <p>
              Ventas, comandas y cierres de jornada en un solo lugar.
            </p>
          </div>

        </section>

        {/* FORMULARIO */}
        <section className="login-card">

          <div className="login-card-top">
            <span className="login-badge">
              <ShieldCheck size={13} />
              PUNTO DE VENTA
            </span>
          </div>

          <div className="login-welcome">
            <span className="eyebrow">CONTROL EMPRESARIAL</span>
            <h1>Bienvenido</h1>
            <p>Inicia sesión para abrir la caja.</p>
          </div>

          <form
            className="login-form"
            onSubmit={handleSubmit}
          >

            <label className="login-field">
              <span>Usuario</span>
              <div className="login-input">
                <UserRound size={18} />
                <input
                  type="text"
                  value={username}
                  autoComplete="username"
                  placeholder="Ingresa tu usuario"
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                />
              </div>
            </label>

            <label className="login-field">
              <span>Contraseña</span>
              <div className="login-input">
                <Lock size={18} />
                <input
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                />
              </div>
            </label>

            {error && (
              <div className="login-error" key={error}>
                {error}
              </div>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="kikis-spinner"></span>
                  Ingresando...
                </>
              ) : (
                <>
                  <LogIn size={19} />
                  Ingresar al sistema
                </>
              )}
            </button>

            <div className="login-security">
              <ShieldCheck size={14} />
              <span>Una sola sesión activa por usuario</span>
            </div>

          </form>

          <footer className="login-footer">
            <ChefHat size={16} />
            <span>Pizzería KIKIS</span>
            <span className="dot">•</span>
            <span>Sistema POS v{APP_VERSION}</span>
          </footer>

        </section>

      </div>

    </div>
  );
}
