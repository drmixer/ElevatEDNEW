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
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('@tanstack/react-query')) {
                return 'react-query';
              }
              if (id.includes('react-markdown') || id.includes('remark')) {
                return 'markdown';
              }
              if (id.includes('recharts')) {
                return 'charts';
              }
              if (id.includes('framer-motion')) {
                return 'motion';
              }
              if (id.includes('lucide-react')) {
                return 'icons';
              }
              return 'vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
