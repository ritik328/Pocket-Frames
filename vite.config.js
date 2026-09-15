import { defineConfig, loadEnv } from 'vite';
import { handleAiRequest } from './server/api/aiRoutes.js';

export default defineConfig(({ mode }) => {
  // Load environment variables server-side into process.env
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    server: {
      port: 5173,
      host: true
    },
    plugins: [
      {
        name: 'pocket-frames-ai-backend',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/api/ai/')) {
              handleAiRequest(req, res, next);
            } else {
              next();
            }
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/api/ai/')) {
              handleAiRequest(req, res, next);
            } else {
              next();
            }
          });
        }
      }
    ]
  };
});
