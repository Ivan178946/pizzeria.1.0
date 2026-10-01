import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// La versión del sistema vive en el package.json de la raíz
const { version } = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    define: {
      __APP_VERSION__: JSON.stringify(version)
    },

    server: {
      port: 5177,
      strictPort: true,

      // Si VITE_API_URL se deja vacío, /api se redirige al
      // backend local (útil para probar desde una tablet o
      // celular en la misma red: http://IP-DE-LA-LAPTOP:5177).
      host: true,
      proxy: {
        '/api': env.API_PROXY_TARGET || 'http://localhost:3002'
      }
    },

    preview: {
      port: 5177,
      strictPort: true
    }
  };
});
