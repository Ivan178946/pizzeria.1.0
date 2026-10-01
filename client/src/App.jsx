import { Fragment, useEffect, useState } from 'react';

import {
  BarChart3,
  CalendarDays,
  LogOut,
  Receipt,
  Settings,
  ShoppingCart,
  Tag
} from 'lucide-react';

import { api } from './services/api.js';
import { APP_FULL_NAME } from './config/version.js';

import Login from './components/Login.jsx';
import POS from './components/POS.jsx';
import Today from './components/Today.jsx';
import Admin from './components/Admin.jsx';
import Shifts from './components/Shifts.jsx';
import Dashboard from './components/Dashboard.jsx';
import Promotions from './components/Promotions.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // =========================================================
  // VERIFICAR SESIÓN
  // =========================================================

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setChecking(false);
      return;
    }

    api('/api/me')
      .then(data => {
        if (data?.user) {
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => {
        setChecking(false);
      });
  }, []);

  // =========================================================
  // LOGIN
  // =========================================================

  async function handleLogin(credentials) {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (!data?.token || !data?.user) {
      throw new Error(
        'El servidor no devolvió una sesión válida.'
      );
    }

    localStorage.setItem('token', data.token);

    setUser(data.user);
  }

  // =========================================================
  // CARGANDO
  // =========================================================

  if (checking) {
    return (
      <div className="loading-screen">
        <div className="loading-pizza">
          <img src="/logo.jpeg" alt="" />
        </div>
        <span>Verificando sesión...</span>
      </div>
    );
  }

  // =========================================================
  // LOGIN
  // =========================================================

  if (!user) {
    return (
      <Login
        onLogin={handleLogin}
      />
    );
  }

  // =========================================================
  // CERRAR SESIÓN
  // =========================================================

  async function logout() {
    try {
      await api('/api/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.warn(
        'No se pudo cerrar sesión en servidor:',
        error
      );
    }

    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <DashboardLayout
      user={user}
      onLogout={logout}
    />
  );
}


// =========================================================
// DASHBOARD PRINCIPAL DE LA APLICACIÓN
// =========================================================

function DashboardLayout({ user, onLogout }) {

  const [tab, setTabState] = useState(
    () => {
      const allowed = user.role === 'admin'
        ? ['pos', 'today', 'dashboard', 'promos', 'admin', 'shifts']
        : ['pos', 'today', 'shifts'];
      const fromUrl = window.location.hash.slice(1);
      return allowed.includes(fromUrl) ? fromUrl : 'pos';
    }
  );

  function setTab(id) {
    // Al volver al punto de venta se traen los precios vigentes
    if (id === 'pos') {
      setMenuTick(value => value + 1);
    }

    setTabState(id);
    window.history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const [menu, setMenu] = useState({
    products: [],
    flavors: [],
    beverages: [],
    extras: []
  });

  const [cart, setCart] = useState([]);

  const [pay, setPay] = useState({
    cash: '',
    qr: ''
  });

  const [message, setMessage] = useState('');

  // QR de pago configurado por el administrador
  const [payment, setPayment] = useState({
    qrEnabled: true,
    qrImage: ''
  });

  const [orders, setOrders] = useState([]);

  const [shifts, setShifts] = useState([]);

  const [users, setUsers] = useState([]);

  const [version, setVersion] = useState(0);

  // Solo recarga el menú (precios, promociones)
  const [menuTick, setMenuTick] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setMenuTick(value => value + 1),
      2 * 60 * 1000
    );

    return () => clearInterval(id);
  }, []);


  // =========================================================
  // RECARGAR INFORMACIÓN
  // =========================================================

  function reload() {
    setVersion(value => value + 1);
  }


  // =========================================================
  // CARGAR MENÚ
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      try {
        const data = await api('/api/menu');

        if (cancelled) return;

        console.log(
          'MENÚ RECIBIDO DEL SERVIDOR:',
          data
        );

        setMenu({
          products: Array.isArray(data?.products)
            ? data.products
            : [],

          flavors: Array.isArray(data?.flavors)
            ? data.flavors
            : [],

          beverages: Array.isArray(data?.beverages)
            ? data.beverages
            : [],

          extras: Array.isArray(data?.extras)
            ? data.extras
            : [],

          promotions: Array.isArray(data?.promotions)
            ? data.promotions
            : []
        });

      } catch (error) {

        console.error(
          'ERROR CARGANDO MENÚ:',
          error
        );

        if (!cancelled) {

          setMenu({
            products: [],
            flavors: [],
            beverages: [],
            extras: []
          });

          setMessage(
            `Error cargando menú: ${error.message}`
          );
        }
      }
    }

    loadMenu();

    return () => {
      cancelled = true;
    };

  }, [version, menuTick]);


  // =========================================================
  // CARGAR CONFIGURACIÓN DE PAGO (QR)
  // =========================================================

  useEffect(() => {
    api('/api/settings/payment')
      .then(data => {
        if (data) setPayment(data);
      })
      .catch(error => {
        console.error(
          'Error cargando configuración de pago:',
          error
        );
      });
  }, [version, menuTick]);


  // =========================================================
  // CARGAR VENTAS DEL DÍA
  // =========================================================

  useEffect(() => {

    api('/api/orders/today')

      .then(data => {

        setOrders(
          Array.isArray(data)
            ? data
            : []
        );

      })

      .catch(error => {

        console.error(
          'Error cargando ventas:',
          error
        );

      });

  }, [version]);


  // =========================================================
  // CARGAR CIERRES Y USUARIOS
  // =========================================================

  useEffect(() => {

    api('/api/admin/shifts')

      .then(data => {

        setShifts(
          Array.isArray(data)
            ? data
            : []
        );

      })

      .catch(error => {

        console.error(
          'Error cargando cierres:',
          error
        );

      });


    // ============================================
    // USUARIOS SOLO PARA ADMIN
    // ============================================

    if (user.role === 'admin') {

      api('/api/admin/users')

        .then(data => {

          setUsers(
            Array.isArray(data)
              ? data
              : []
          );

        })

        .catch(error => {

          console.error(
            'Error cargando usuarios:',
            error
          );

        });

    } else {

      setUsers([]);

    }

  }, [version, user.role]);


  // =========================================================
  // AGREGAR PRODUCTO AL CARRITO
  // =========================================================

  function add(item) {

    setCart(current => [

      ...current,

      {
        ...item,
        uid: crypto.randomUUID()
      }

    ]);

  }


  // =========================================================
  // FINALIZAR VENTA
  // =========================================================

  async function finish(orderInfo = {}) {

    if (!cart.length) {
      return false;
    }


    // ============================================
    // CALCULAR TOTAL
    // ============================================

    const total = cart.reduce(
      (sum, item) =>
        sum + Number(item.price || 0),
      0
    );


    // ============================================
    // PAGOS
    // ============================================

    const cash =
      Number(pay.cash || 0);

    const qr =
      Number(pay.qr || 0);


    // ============================================
    // VALIDAR PAGO
    // ============================================

    if (cash + qr + 0.001 < total) {

      setMessage(
        `Falta Bs ${(total - cash - qr).toFixed(2)} para completar el pago`
      );

      return false;
    }


    // ============================================
    // REGISTRAR VENTA
    // ============================================

    try {

      const result = await api(
        '/api/orders',
        {
          method: 'POST',

          body: JSON.stringify({

            items: cart,

            total,

            cash,

            qr,

            serviceType:
              orderInfo.serviceType ||
              'takeaway',

            tableNumber:
              orderInfo.tableNumber ||
              ''

          })
        }
      );


      // ============================================
      // ACTUALIZAR VENTAS
      // ============================================

      const freshOrders =
        await api('/api/orders/today');


      setOrders(
        Array.isArray(freshOrders)
          ? freshOrders
          : []
      );


      // ============================================
      // LIMPIAR CARRITO
      // ============================================

      setCart([]);

      setPay({
        cash: '',
        qr: ''
      });


      // ============================================
      // MENSAJE
      // ============================================

      setMessage(
        `✓ Venta ${result.orderNo || ''} registrada. Vuelto: Bs ${Number(result.change || 0).toFixed(2)}`
      );


      setTimeout(() => {

        setMessage('');

      }, 5000);


      // Se devuelve la venta registrada (código KIKIS-000001)
      // para mostrarla en la comanda impresa.
      return result || true;

    } catch (error) {

      console.error(
        'Error registrando venta:',
        error
      );

      setMessage(
        `Error: ${error.message}`
      );

      return false;
    }
  }


  // =========================================================
  // ELIMINAR VENTA
  // =========================================================

  async function deleteOrder(id) {

    if (!confirm('¿Eliminar esta venta?')) {
      return;
    }


    try {

      await api(
        `/api/orders/${id}`,
        {
          method: 'DELETE'
        }
      );


      reload();

    } catch (error) {

      setMessage(
        error.message
      );

    }
  }


  // =========================================================
  // MENÚ LATERAL
  // =========================================================

  const nav = [

    [
      'pos',
      'Punto de venta',
      ShoppingCart
    ],

    [
      'today',
      'Ventas de hoy',
      Receipt
    ],

    // ==========================================
    // OPCIONES SOLO ADMINISTRADOR
    // ==========================================

    ...(user.role === 'admin'

      ? [

          [
            'dashboard',
            'Estadísticas',
            BarChart3
          ],

          [
            'promos',
            'Precios y promociones',
            Tag
          ],

          [
            'admin',
            'Administración',
            Settings
          ],

          [
            'shifts',
            'Cierres de jornada',
            CalendarDays
          ]

        ]

      : [

          [
            'shifts',
            'Cierre de jornada',
            CalendarDays
          ]

        ])

  ];


  // =========================================================
  // TÍTULO DE LA PÁGINA
  // =========================================================

  const pageInfo = {
    pos: 'Registra pedidos y cobra en segundos.',
    today: 'Todas las ventas registradas durante la jornada.',
    dashboard: 'Rendimiento del día, del mes y de la última semana.',
    promos: 'Edita precios, crea ofertas y administra sabores, refrescos y extras.',
    admin: 'Tu perfil, los usuarios y los accesos al sistema.',
    shifts: 'Cierra la jornada y consulta el histórico.'
  };

  function getPageTitle() {

    if (tab === 'pos') {
      return 'Punto de venta';
    }

    if (tab === 'today') {
      return 'Ventas de hoy';
    }

    if (tab === 'dashboard') {
      return 'Estadísticas';
    }

    if (tab === 'promos') {
      return 'Precios y promociones';
    }

    if (tab === 'admin') {
      return 'Administración';
    }

    return 'Cierre de jornada';
  }


  // =========================================================
  // INTERFAZ
  // =========================================================

  return (

    <div className="app">


      {/* =================================================
          BARRA LATERAL
      ================================================= */}

      <aside>


        {/* ===============================================
            LOGO
        =============================================== */}

        <div className="side-brand">

          <img
            src="/logo.jpeg"
            alt="Pizzería KIKIS"
            className="brand-logo"
          />

          <div className="brand-text">

            <b>
              PIZZERÍA KIKIS
            </b>

          </div>

        </div>


        {/* ===============================================
            NAVEGACIÓN
        =============================================== */}

        <div className="nav">

          {nav.map(
            ([id, label, Icon], index) => (

              <Fragment key={id}>

              {id === 'pos' && (
                <span className="nav-label">Operación</span>
              )}

              {id === 'dashboard' && (
                <span className="nav-label">Gestión</span>
              )}

              <button
                type="button"
                style={{ '--i': index }}

                className={
                  tab === id
                    ? 'active'
                    : ''
                }

                onClick={() =>
                  setTab(id)
                }
              >

                <Icon size={18} />

                <span>
                  {label}
                </span>

              </button>

              </Fragment>

            )
          )}

        </div>


        {/* ===============================================
            USUARIO
        =============================================== */}

        <div className="side-bottom">


          <div className="user-chip">


            <div className="avatar">

              {
                user.name?.[0]?.toUpperCase() ||
                'U'
              }

            </div>


            <div>

              <b>

                {
                  user.name ||
                  user.username
                }

              </b>


              <span>

                {
                  user.role === 'admin'
                    ? 'Administrador'
                    : 'Usuario operativo'
                }

              </span>

            </div>

          </div>


          {/* =============================================
              CERRAR SESIÓN
          ============================================= */}

          <button
            className="logout"
            type="button"
            onClick={onLogout}
          >

            <LogOut size={17} />

            Cerrar sesión

          </button>


          {/* =============================================
              VERSIÓN DEL SISTEMA
          ============================================= */}

          <span className="app-version">
            {APP_FULL_NAME}
          </span>


        </div>

      </aside>


      {/* =================================================
          CONTENIDO PRINCIPAL
      ================================================= */}

      <main>


        {/* ===============================================
            CABECERA
        =============================================== */}

        <header>

          <div>

            <div className="crumbs">
              <span>Pizzería KIKIS</span>
              <i>/</i>
              <span>
                {user.role === 'admin' ? 'Control empresarial' : 'Operación'}
              </span>
            </div>

            <div key={tab} className="page-title">

              <h2>
                {getPageTitle()}
              </h2>

              <p>
                {pageInfo[tab]}
              </p>

            </div>

          </div>


          <div className="header-right">

            <LiveClock />

            <span className="live">

              <i />

              Sistema operativo

            </span>

          </div>

        </header>


        <div className="page-transition" key={tab}>

        {/* =================================================
            PUNTO DE VENTA
        ================================================= */}

        {tab === 'pos' && (

          <POS

            menu={menu}

            cart={cart}

            add={add}

            remove={uid =>
              setCart(
                current =>
                  current.filter(
                    item =>
                      item.uid !== uid
                  )
              )
            }

            pay={pay}

            setPay={setPay}

            payment={payment}

            finish={finish}

            message={message}

          />

        )}


        {/* =================================================
            VENTAS DE HOY
        ================================================= */}

        {tab === 'today' && (

          <Today

            orders={orders}

            isAdmin={
              user.role === 'admin'
            }

            onDelete={deleteOrder}

            reload={reload}

          />

        )}


        {/* =================================================
            DASHBOARD
        ================================================= */}

        {tab === 'dashboard' &&
          user.role === 'admin' && (

            <Dashboard />

        )}


        {/* =================================================
            PROMOCIONES Y MENÚ
        ================================================= */}

        {tab === 'promos' &&
          user.role === 'admin' && (

            <Promotions

              reload={reload}

            />

        )}


        {/* =================================================
            ADMINISTRACIÓN
        ================================================= */}

        {tab === 'admin' &&
          user.role === 'admin' && (

            <Admin

              users={users}

              reload={reload}

            />

        )}


        {/* =================================================
            CIERRE DE JORNADA
        ================================================= */}

        {tab === 'shifts' && (

          <Shifts

            shifts={shifts}

            user={user}

            reload={reload}

          />

        )}

        </div>

      </main>

    </div>
  );
}


// =========================================================
// RELOJ EN VIVO
// =========================================================

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="live-clock">
      <b>
        {now.toLocaleTimeString('es-BO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })}
      </b>
      <span>
        {now.toLocaleDateString('es-BO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        })}
      </span>
    </div>
  );
}
