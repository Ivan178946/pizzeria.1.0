# Changelog

Todos los cambios importantes de **Pizzería KIKIS POS** se registran aquí.

Formato de versiones (`MAYOR.MENOR.PARCHE`):

- **MAYOR** (`2.0.0`): cambios grandes que modifican la forma de trabajar o la base de datos.
- **MENOR** (`1.1.0`): mejoras y funciones nuevas pedidas por el cliente.
- **PARCHE** (`1.0.1`): correcciones de errores, sin funciones nuevas.

## [Sin publicar]

- Mejoras futuras.

## v1.0.0 — 2026-10-01

Primera publicación del sistema.

### Funciones
- Sistema POS inicial con inicio de sesión por usuario (administrador y cajero).
- Punto de venta: pizzas por tamaño, mitad y mitad, ingredientes extra, refrescos y combos.
- Ventas de hoy con buscador y filtros por efectivo, QR o todos.
- Detalle completo de cada pedido.
- Código de pedido correlativo por día: `KIKIS-000001`, que se reinicia cada día.
- Impresión de tickets para impresora térmica de 80 mm y 58 mm.
- Precios por tamaño editables desde administración.
- Promociones flexibles: varias opciones por promoción, cualquier producto y cantidad, precio promocional, ahorro calculado, vigencia por fechas e imagen o ícono.
- Pago en efectivo, QR o mixto, con cálculo de vuelto.
- QR de pago configurable por el administrador.
- Estadísticas del día, del mes y de la semana.
- Cierres de jornada con histórico.
- Administración de usuarios y perfil.

### Técnico
- Frontend en el puerto `5177` en desarrollo.
- Configuración por variables de entorno (`.env`), sin URLs ni claves fijas en el código.
- Preparado para publicarse en internet con un solo servicio (web + API) y la base de datos en un disco persistente en la nube.
- Versión visible en el panel: `Pizzería KIKIS POS v1.0.0`.
