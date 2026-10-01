import { useEffect, useState } from 'react';

// =========================================================
// PIZZA GIRATORIA DEL LOGIN
// Pizza redonda dibujada en SVG que gira sin parar y cambia
// de sabor cada pocos segundos (o al hacer clic).
// =========================================================

const CHANGE_EVERY_MS = 3200;

const FLAVORS = [
  {
    name: 'Pepperoni',
    cheese: '#f6c445',
    toppings: [['pepperoni', 15]]
  },
  {
    name: 'Hawaiana',
    cheese: '#f7cd55',
    toppings: [['ham', 9], ['pineapple', 11]]
  },
  {
    name: 'Margarita',
    cheese: '#f9d772',
    toppings: [['tomato', 6], ['mozza', 7], ['basil', 7]]
  },
  {
    name: 'Americana',
    cheese: '#f6c445',
    toppings: [['ham', 13], ['olive', 7]]
  },
  {
    name: 'Cuatro Quesos',
    cheese: '#fbe29a',
    toppings: [['mozza', 9], ['blue', 8], ['cheddar', 9]]
  },
  {
    name: 'Carnívora',
    cheese: '#f2bb3c',
    toppings: [['pepperoni', 8], ['bacon', 6], ['sausage', 10]]
  }
];

// Reparte los ingredientes intercalando los tipos:
// A B C A B C ... para que no queden agrupados.
function expandToppings(toppings) {
  const pools = toppings.map(([type, count]) => Array(count).fill(type));
  const result = [];

  while (pools.some(pool => pool.length)) {
    for (const pool of pools) {
      if (pool.length) result.push(pool.pop());
    }
  }

  return result;
}

// Distribución tipo girasol: cubre el círculo de forma pareja.
function sunflower(index, total, maxRadius) {
  const golden = 137.508 * (Math.PI / 180);
  const r = maxRadius * Math.sqrt((index + 0.6) / total);
  const angle = index * golden;

  return {
    x: r * Math.cos(angle),
    y: r * Math.sin(angle),
    rotate: (index * 53) % 360
  };
}

// Borde ondulado del queso derretido.
function cheesePath(radius) {
  const points = [];

  for (let i = 0; i <= 72; i += 1) {
    const a = (i / 72) * Math.PI * 2;
    const r = radius + 2.6 * Math.sin(a * 9) + 1.4 * Math.sin(a * 23);
    points.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
  }

  return `M${points.join('L')}Z`;
}

const CHEESE_PATH = cheesePath(78);

function Topping({ type }) {
  switch (type) {
    case 'pepperoni':
      return (
        <g>
          <circle r="9.5" fill="#b8261c" stroke="#8c1a12" strokeWidth="1.2" />
          <circle cx="-3" cy="-2.5" r="1.6" fill="#8c1a12" />
          <circle cx="3" cy="2" r="1.3" fill="#8c1a12" />
          <circle cx="2.5" cy="-4" r="1" fill="#d9483a" />
        </g>
      );

    case 'ham':
      return <rect x="-7" y="-5" width="14" height="10" rx="2.5" fill="#f19c9b" stroke="#d9787a" strokeWidth="1" />;

    case 'pineapple':
      return <path d="M-5 -4 L5 -4 L6.5 4 L-6.5 4 Z" fill="#ffd84a" stroke="#e2b000" strokeWidth="1" strokeLinejoin="round" />;

    case 'tomato':
      return (
        <g>
          <circle r="10.5" fill="#df3b25" />
          <circle r="7.5" fill="#f06a4c" />
          <circle cx="-2.5" cy="-1.5" r="1.3" fill="#fbe3a0" />
          <circle cx="2.5" cy="-1.5" r="1.3" fill="#fbe3a0" />
          <circle cx="0" cy="3" r="1.3" fill="#fbe3a0" />
        </g>
      );

    case 'mozza':
      return <ellipse rx="8" ry="6" fill="#fffaf0" stroke="#f1e6cc" strokeWidth="1" />;

    case 'basil':
      return (
        <g>
          <path d="M-9 0 Q0 -8 9 0 Q0 8 -9 0 Z" fill="#2f8f3a" />
          <path d="M-8 0 L8 0" stroke="#5cb85c" strokeWidth="0.9" />
        </g>
      );

    case 'olive':
      return (
        <g>
          <circle r="4.6" fill="#2a2522" />
          <circle r="1.8" fill="#6b4f3a" />
        </g>
      );

    case 'blue':
      return (
        <g>
          <ellipse rx="7" ry="5.5" fill="#f4f1e8" />
          <circle cx="-2" cy="-1" r="1.1" fill="#6b86a8" />
          <circle cx="2.4" cy="1.2" r="0.9" fill="#6b86a8" />
          <circle cx="0.5" cy="-2.4" r="0.7" fill="#6b86a8" />
        </g>
      );

    case 'cheddar':
      return <rect x="-5" y="-5" width="10" height="10" rx="2" fill="#f39a1d" stroke="#d97e00" strokeWidth="1" />;

    case 'bacon':
      return (
        <g>
          <path d="M-12 -3 Q-6 -7 0 -3 T12 -3 L12 3 Q6 -1 0 3 T-12 3 Z" fill="#b94a34" />
          <path d="M-12 0 Q-6 -4 0 0 T12 0" stroke="#f3b9a2" strokeWidth="1.6" fill="none" />
        </g>
      );

    case 'sausage':
      return (
        <g>
          <circle r="5.5" fill="#7b3f1f" />
          <circle cx="-1.5" cy="-1.5" r="1.2" fill="#a0603a" />
        </g>
      );

    default:
      return null;
  }
}

function PizzaSvg({ flavor }) {
  const toppings = expandToppings(flavor.toppings);

  return (
    <svg
      className="spin-pizza-svg"
      viewBox="-100 -100 200 200"
      role="img"
      aria-label={`Pizza ${flavor.name}`}
    >
      <defs>
        <radialGradient id="crust" r="0.5">
          <stop offset="80%" stopColor="#e7a44c" />
          <stop offset="93%" stopColor="#c97a2c" />
          <stop offset="100%" stopColor="#9c5718" />
        </radialGradient>
        <radialGradient id="shine" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#fff" stopOpacity=".28" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* masa */}
      <circle r="97" fill="url(#crust)" />

      {[...Array(14)].map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <circle
            key={i}
            cx={90 * Math.cos(a)}
            cy={90 * Math.sin(a)}
            r={i % 3 === 0 ? 2.2 : 1.5}
            fill="#a8621f"
            opacity=".55"
          />
        );
      })}

      {/* salsa y queso */}
      <circle r="84" fill="#c9381f" />
      <path d={CHEESE_PATH} fill={flavor.cheese} />

      {/* cortes de las porciones */}
      {[...Array(4)].map((_, i) => (
        <line
          key={i}
          x1="0"
          y1="-84"
          x2="0"
          y2="84"
          stroke="#b0661f"
          strokeOpacity=".35"
          strokeWidth="1.4"
          transform={`rotate(${i * 45})`}
        />
      ))}

      {/* ingredientes: aparecen uno tras otro */}
      <g>
        {toppings.map((type, i) => {
          const { x, y, rotate } = sunflower(i, toppings.length, 64);

          return (
            <g key={i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotate})`}>
              <g
                className="spin-pizza-topping"
                style={{ animationDelay: `${i * 28}ms` }}
              >
                <Topping type={type} />
              </g>
            </g>
          );
        })}
      </g>

      {/* orégano */}
      {[...Array(26)].map((_, i) => {
        const { x, y } = sunflower(i * 3 + 1, 80, 76);
        return <circle key={`o${i}`} cx={x} cy={y} r="0.9" fill="#3d6b2a" opacity=".7" />;
      })}

      <circle r="97" fill="url(#shine)" />
    </svg>
  );
}

export default function SpinningPizza() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;

    const id = setInterval(
      () => setIndex(i => (i + 1) % FLAVORS.length),
      CHANGE_EVERY_MS
    );

    return () => clearInterval(id);
  }, [paused]);

  const flavor = FLAVORS[index];

  return (
    <div
      className="spin-pizza"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        className="spin-pizza-stage"
        title="Cambiar sabor"
        onClick={() => setIndex(i => (i + 1) % FLAVORS.length)}
      >
        <span className="login-pizza-ring" />
        <span className="spin-pizza-rotor">
          {/* key: al cambiar de sabor se vuelve a montar y da un giro rápido */}
          <span className="spin-pizza-boost" key={index}>
            <PizzaSvg flavor={flavor} />
          </span>
        </span>
      </button>

      <div className="spin-pizza-label" key={flavor.name}>
        <span>Sabor</span>
        <b>{flavor.name}</b>
      </div>

      <div className="spin-pizza-dots">
        {FLAVORS.map((f, i) => (
          <button
            key={f.name}
            type="button"
            aria-label={f.name}
            className={i === index ? 'active' : ''}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
