# =========================================================
# PIZZERÍA KIKIS POS — IMAGEN DE PRODUCCIÓN
# Un solo servicio entrega la página web y la API.
# La base de datos SQLite se guarda en /data (volumen
# persistente del hosting: NO se borra al actualizar).
# =========================================================

# ---------- 1) Compilar ----------
FROM node:22-bookworm-slim AS build

# Herramientas por si better-sqlite3 necesita compilarse
RUN apt-get update  && apt-get install -y --no-install-recommends python3 make g++  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

RUN npm --prefix client ci  && npm --prefix server ci --omit=dev

COPY client ./client
RUN npm --prefix client run build


# ---------- 2) Ejecutar ----------
FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3002
ENV DB_PATH=/data/pizzeria.db

WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/
COPY --from=build /app/server/node_modules ./server/node_modules
COPY server/src ./server/src
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /data

EXPOSE 3002

CMD ["node", "server/src/index.js"]
