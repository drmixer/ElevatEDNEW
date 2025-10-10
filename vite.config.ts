import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiHandler } from './server/api.js';
import { createServiceRoleClient } from './scripts/utils/supabase.js';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const enableProxy =
    command === 'serve' &&
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const proxyPlugin = enableProxy
    ? [
        {
          name: 'elevated-api-proxy',
          configureServer(server) {
            const supabase = createServiceRoleClient();
            const handler = createApiHandler({ supabase });
            server.middlewares.use(async (req, res, next) => {
              const handled = await handler(req, res);
              if (!handled) {
                next();
              }
            });
          },
        },
      ]
    : [];

  return {
    plugins: [react(), ...proxyPlugin],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
