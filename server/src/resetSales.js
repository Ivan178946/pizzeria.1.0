import { db } from './db.js';

console.log('======================================');
console.log(' REINICIO DE VENTAS - PIZZERÍA KIKIS');
console.log('======================================');

const ordersBefore = db
  .prepare('SELECT COUNT(*) AS total FROM orders')
  .get();

const shiftsBefore = db
  .prepare('SELECT COUNT(*) AS total FROM shifts')
  .get();

console.log(`Ventas encontradas: ${ordersBefore.total}`);
console.log(`Cierres encontrados: ${shiftsBefore.total}`);

db.exec(`
  DELETE FROM orders;
  DELETE FROM shifts;
  DELETE FROM order_counters;
`);

const ordersAfter = db
  .prepare('SELECT COUNT(*) AS total FROM orders')
  .get();

const shiftsAfter = db
  .prepare('SELECT COUNT(*) AS total FROM shifts')
  .get();

console.log('');
console.log('Datos eliminados correctamente.');
console.log(`Ventas actuales: ${ordersAfter.total}`);
console.log(`Cierres actuales: ${shiftsAfter.total}`);

console.log('');
console.log('NO se eliminaron:');
console.log('- Usuarios');
console.log('- Productos');
console.log('- Sabores');
console.log('- Bebidas');
console.log('- Extras');

console.log('');
console.log('PIZZERÍA KIKIS AHORA COMIENZA DESDE 0.');
console.log('======================================');

db.close();