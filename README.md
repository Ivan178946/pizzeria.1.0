# Pizzería KIKIS POS

Sistema de punto de venta (POS) para Pizzería KIKIS: ventas, promociones, pago
en efectivo, QR o mixto, tickets, estadísticas y cierres de jornada.

- Versión actual: ver `package.json` (también aparece en el panel: *Pizzería KIKIS POS v1.0.0*).
- Historial de cambios: [`CHANGELOG.md`](CHANGELOG.md).
- Publicar en internet: [`DEPLOY.md`](DEPLOY.md).

## Estructura

```
client/   Frontend (React + Vite)        → http://localhost:5177
server/   Backend / API (Node + Express)  → http://localhost:3002
          Base de datos SQLite: server/pizzeria.db (o DB_PATH)
Dockerfile, railway.json   Publicación en internet
```

## Instalación (una sola vez)

Requiere Node.js 20.12 o superior. Desde la carpeta raíz:

```powershell
npm run install:all
```

Copia los archivos de ejemplo de variables de entorno si no existen:

- `server/.env.example` → `server/.env`
- `client/.env.example` → `client/.env.development` (ya incluido)

## Comandos

| Comando | Para qué sirve |
|---|---|
| `npm run dev` | **Desarrollo**: inicia el backend y el frontend juntos. Abre <http://localhost:5177>. |
| `npm run server` | Solo el backend en <http://localhost:3002>. Se reinicia solo al guardar cambios. |
| `npm run client` | Solo el frontend en <http://localhost:5177>. |
| `npm run build` | Compila la página web para producción (`client/dist`). |
| `npm run start` | **Producción**: inicia el servidor, que entrega la web compilada y la API. |
| `npm run reset:sales` | Borra todas las ventas y cierres (deja usuarios y menú). ¡Cuidado! |

Usuario inicial: `admin`. La contraseña es la de `ADMIN_INITIAL_PASSWORD`, o
`Admin123!` si no se definió. Cámbiala al ingresar.

### Probar desde una tablet o celular (misma red Wi-Fi)

1. En `client/.env.development` deja `VITE_API_URL=` vacío.
2. Ejecuta `npm run dev` y abre `http://IP-DE-TU-LAPTOP:5177` en la tablet.
   La IP aparece en la consola de Vite (*Network*).

## Variables de entorno

**Servidor** (`server/.env`; en producción se definen en el hosting):

| Variable | Descripción |
|---|---|
| `NODE_ENV` | `development` o `production` |
| `PORT` | Puerto del backend (por defecto `3002`) |
| `JWT_SECRET` | Secreto de las sesiones. **Obligatorio en producción.** |
| `DB_PATH` | Archivo de la base de datos. En la nube: `/data/pizzeria.db` |
| `ADMIN_INITIAL_PASSWORD` | Contraseña del `admin` cuando la base de datos está vacía |
| `CORS_ORIGINS` | Dominios permitidos si la web está en otro dominio (separados por coma) |

**Frontend** (`client/.env.development` / `client/.env.production`):

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL del backend. Desarrollo: `http://localhost:3002`. Producción: vacío (mismo dominio) |

`server/.env` contiene datos privados y **no se sube a git**.

## Pago y vuelto

- Efectivo igual al total → vuelto Bs 0.
- Efectivo mayor al total → calcula y guarda el vuelto.
- Efectivo + QR (pago mixto) igual o mayor al total → registra la venta.
- Si lo pagado es menor al total → no permite registrar.
- El QR de pago se configura en *Administración → Pago por QR*.

## Versiones

El número de versión está en el `package.json` de la raíz y se muestra en el
panel. Se usa `MAYOR.MENOR.PARCHE`:

- `1.0.1` corrección de errores
- `1.1.0` mejoras pedidas por el cliente
- `2.0.0` cambios grandes

### Ramas de git

| Rama | Uso |
|---|---|
| `main` | Versión **estable** que usa el cliente. El hosting publica desde aquí. |
| `develop` | Donde se hacen y prueban las mejoras. |
| tags `v1.0.0`, `v1.1.0`... | Cada versión oficial publicada. |

### Flujo para sacar una versión nueva (ej. 1.1.0)

```powershell
# 1. Trabajar las mejoras en develop
git checkout develop
#    ... cambios ...
git add -A
git commit -m "Agrega reporte de ventas por producto"

# 2. Anotar los cambios en CHANGELOG.md (sección v1.1.0) y hacer commit

# 3. Pasar a main y marcar la versión
git checkout main
git merge develop
npm version minor -m "Versión %s"   # 1.0.0 → 1.1.0: actualiza package.json, crea el commit y el tag v1.1.0

# 4. Publicar
git push origin main --tags
git checkout develop
git merge main
git push origin develop
```

Para una corrección urgente usa `npm version patch` (1.1.0 → 1.1.1). Para un
cambio grande usa `npm version major` (→ 2.0.0).

Si una versión nueva falla, se puede volver a la anterior desde el hosting
(Railway → *Deployments → Redeploy* de la versión previa) o con
`git checkout v1.0.0`.
