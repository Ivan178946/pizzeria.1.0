import { useEffect, useState } from 'react';

import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Package,
  ShoppingBag,
  TrendingUp,
  Wallet
} from 'lucide-react';

import { api } from '../services/api.js';
import { money } from '../utils/format.js';
import AnimatedNumber from './AnimatedNumber.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    try {
      setLoading(true);
      setError('');

      const result = await api('/api/dashboard');

      setData(result);
    } catch (err) {
      console.error('Error cargando dashboard:', err);
      setError(err.message || 'No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <section className="dashboard-page">
        <div className="dashboard-skeleton">
          <div className="skeleton skeleton-title" />
          <div className="dashboard-cards">
            {[0, 1, 2, 3].map(i => (
              <div className="skeleton skeleton-card" key={i} />
            ))}
          </div>
          <div className="skeleton skeleton-wide" />
          <div className="skeleton skeleton-chart" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="dashboard-page">
        <div className="dashboard-error">
          <b>Error</b>
          <span>{error}</span>

          <button type="button" onClick={loadDashboard}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <section className="dashboard-page">

      {/* ENCABEZADO */}

      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">ESTADÍSTICAS DE VENTAS</span>

          <h1>Estadísticas</h1>

          <p>
            Resumen de ventas de Pizzería KIKIS.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-refresh"
          onClick={loadDashboard}
        >
          Actualizar
        </button>
      </div>


      {/* TARJETAS DE HOY */}

      <div className="dashboard-section-title">
        <CalendarDays size={18} />
        <span>Ventas de hoy</span>
      </div>

      <div className="dashboard-cards">

        <StatCard
          icon={TrendingUp}
          title="Ventas de hoy"
          value={data.today.total}
          format={money}
          description="Total vendido"
        />

        <StatCard
          icon={ShoppingBag}
          title="Pedidos"
          value={data.today.orders}
          description="Pedidos realizados"
        />

        <StatCard
          icon={Wallet}
          title="Efectivo"
          value={data.today.cash}
          format={money}
          description="Efectivo real"
        />

        <StatCard
          icon={CreditCard}
          title="QR"
          value={data.today.qr}
          format={money}
          description="Pagos por QR"
        />

      </div>


      {/* MES */}

      <div className="dashboard-section-title">
        <BarChart3 size={18} />
        <span>Resumen del mes</span>
      </div>

      <div className="dashboard-month-card">

        <div>
          <span>Ventas acumuladas</span>
          <strong><AnimatedNumber value={data.month.total} format={money} /></strong>
        </div>

        <div>
          <span>Pedidos</span>
          <strong><AnimatedNumber value={data.month.orders} /></strong>
        </div>

        <div>
          <span>Ticket promedio</span>
          <strong><AnimatedNumber value={data.month.averageTicket} format={money} /></strong>
        </div>

      </div>


      {/* MÁS VENDIDO */}

      <div className="dashboard-section-title">
        <Package size={18} />
        <span>Lo más vendido hoy</span>
      </div>

      <div className="dashboard-top-grid">

        <div className="dashboard-top-card">

          <div className="dashboard-top-icon">
            <ShoppingBag size={22} />
          </div>

          <div>
            <span>Producto más vendido</span>

            <strong>
              {data.topProduct.name}
            </strong>

            <small>
              {data.topProduct.quantity} unidad(es)
            </small>
          </div>

        </div>


        <div className="dashboard-top-card">

          <div className="dashboard-top-icon">
            <Package size={22} />
          </div>

          <div>
            <span>Sabor más vendido</span>

            <strong>
              {data.topFlavor.name}
            </strong>

            <small>
              {data.topFlavor.quantity} pedido(s)
            </small>
          </div>

        </div>

      </div>


      {/* GRÁFICO */}

      <div className="dashboard-section-title">
        <TrendingUp size={18} />
        <span>Ventas de los últimos 7 días</span>
      </div>

      <div className="dashboard-chart-card">

        <div className="dashboard-chart">

          {data.chart.map((day, index) => {

            const max =
              Math.max(
                ...data.chart.map(item =>
                  Number(item.total || 0)
                ),
                1
              );

            const height =
              Math.max(
                (Number(day.total || 0) / max) * 100,
                day.total > 0 ? 6 : 2
              );

            return (
              <div
                className="dashboard-chart-column"
                key={day.date}
                style={{ '--i': index }}
              >

                <div className="dashboard-chart-value">
                  {day.total > 0
                    ? `Bs ${Number(day.total).toFixed(0)}`
                    : '—'}
                </div>

                <div className="dashboard-chart-bar-wrapper">

                  <div
                    className="dashboard-chart-bar"
                    style={{
                      height: `${height}%`
                    }}
                  />

                </div>

                <div className="dashboard-chart-label">
                  {day.label}
                </div>

              </div>
            );
          })}

        </div>

      </div>

    </section>
  );
}


/* -----------------------------------------
   TARJETA ESTADÍSTICA
----------------------------------------- */

function StatCard({
  icon: Icon,
  title,
  value,
  format,
  description
}) {
  return (
    <div className="dashboard-stat-card">

      <div className="dashboard-stat-icon">
        <Icon size={21} />
      </div>

      <div className="dashboard-stat-content">

        <span>{title}</span>

        <strong>
          <AnimatedNumber value={value} format={format} />
        </strong>

        <small>{description}</small>

      </div>

    </div>
  );
}