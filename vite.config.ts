import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiHandler } from './server/api.js';
import { createServiceRoleClient } from './scripts/utils/supabase.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
