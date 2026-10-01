# Publicar Pizzería KIKIS POS en internet

Esta guía deja el sistema funcionando en una dirección como
`https://kikis-pos.up.railway.app` (o tu propio dominio), y se puede abrir
desde una laptop, una tablet o un celular.

## Cómo queda armado

```
Navegador (laptop / tablet / celular)
        │  https://tu-dominio
        ▼
Servidor Node (un solo servicio)
  ├─ entrega la página web   (client/dist)
  ├─ entrega la API          (/api/...)
  └─ guarda los datos en     /data/pizzeria.db  ← disco persistente en la nube
```

- **Una sola dirección**: la web y la API están en el mismo dominio. Así no hay
  problemas de CORS y no hace falta configurar `VITE_API_URL`.
- **Base de datos en la nube**: SQLite guardado en un *volumen persistente* del
  hosting. Ahí se guardan productos, ventas, pedidos, promociones, usuarios, el
  QR de pago, los métodos de pago y los cierres de jornada. Los datos **no se
  borran** al publicar versiones nuevas.
- **HTTPS** lo pone el hosting automáticamente.

## Opción recomendada: Railway

Railway detecta el `Dockerfile` y el archivo `railway.json` del proyecto.

### 1. Subir el código a GitHub

1. Crea un repositorio **privado** en GitHub, por ejemplo `pizzeria-kikis-pos`.
2. Desde la carpeta del proyecto:

   ```powershell
   git remote add origin https://github.com/TU-USUARIO/pizzeria-kikis-pos.git
   git push -u origin main
   git push origin develop
   git push origin --tags
   ```

### 2. Crear el servicio

1. Entra a <https://railway.com> e inicia sesión con GitHub.
2. Elige **New Project → Deploy from GitHub repo** y selecciona el repositorio.
3. En **Settings → Source**, elige la rama **`main`**: es la que verá el cliente.

### 3. Agregar el disco persistente (muy importante)

1. En el servicio, entra a **Settings → Volumes** (o clic derecho → *Attach Volume*).
2. Pon como *Mount path*: **`/data`**.

Sin el volumen, la base de datos se borra en cada actualización.

### 4. Variables de entorno

En **Variables** agrega:

| Variable | Valor |
|---|---|
| `JWT_SECRET` | Un texto largo y aleatorio. Para generarlo: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_INITIAL_PASSWORD` | La contraseña inicial del usuario `admin`. Cámbiala al entrar por primera vez. |
| `DB_PATH` | `/data/pizzeria.db` (ya viene en el Dockerfile; ponla para que sea explícito). |

`NODE_ENV=production` y el puerto ya vienen configurados en el `Dockerfile`.

### 5. Dominio

1. En **Settings → Networking**, usa **Generate Domain**. Te da una dirección
   `https://...up.railway.app`.
2. Si tienes dominio propio (ej. `pos.pizzeriakikis.com`), agrégalo en
   **Custom Domain** y sigue las instrucciones de DNS.

### 6. Comprobar

- Abre `https://TU-DOMINIO/api/health`. Debe responder
  `{"ok":true,"version":"1.0.0","environment":"production"}`.
- Abre `https://TU-DOMINIO` e ingresa con `admin` y la contraseña de
  `ADMIN_INITIAL_PASSWORD`.
- **Cambia la contraseña** en *Administración → Mi perfil*.

## Datos actuales (productos, ventas, usuarios)

En la nube el sistema empieza con una base de datos **nueva**: crea el
administrador y el menú inicial. Hay dos caminos:

- **Empezar limpio** (recomendado para la apertura): cargar productos,
  promociones y QR desde la pantalla de administración.
- **Llevar la base de datos local**: hay que copiar `server/pizzeria.db` al
  volumen `/data` antes del primer uso. Railway no tiene un botón para subir
  archivos al volumen; se hace con su CLI. Pide ayuda para este paso si lo
  necesitas.

## Publicar una versión nueva

Ver la sección **Versiones** del `README.md`. En resumen: se trabaja en
`develop`, se pasa a `main` y Railway publica solo, sin perder los datos.

## Respaldo de la base de datos

Toda la información está en un solo archivo: `/data/pizzeria.db`. Es
recomendable descargar una copia periódicamente (por ejemplo, cada semana).
Railway también ofrece respaldos del volumen según el plan.

## Otras opciones de hosting

El `Dockerfile` funciona en cualquier servicio que soporte Docker y un disco
persistente:

- **Render**: *Web Service* con Docker y un *Persistent Disk* montado en `/data`
  (el disco requiere un plan de pago).
- **Fly.io**: `fly launch` y un *volume* montado en `/data`.
- **VPS** (DigitalOcean, Contabo, etc.): `docker build -t kikis-pos .` y
  `docker run -d -p 80:3002 -v kikis-data:/data -e JWT_SECRET=... kikis-pos`,
  más un proxy con HTTPS (Caddy o Nginx).

Si más adelante se necesita una base de datos administrada (PostgreSQL, por
ejemplo en Supabase o Neon), es un cambio grande que conviene hacer como
versión `v2.0.0`.

## Frontend y API en dominios distintos (opcional)

Si algún día publicas la web en Vercel o Netlify y la API en otro servidor:

1. En el frontend (`client/.env.production`):
   `VITE_API_URL=https://api.tu-pizzeria.com`
2. En el servidor: `CORS_ORIGINS=https://tu-pizzeria.com`
