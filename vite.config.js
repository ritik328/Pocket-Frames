import { defineConfig, loadEnv } from 'vite';
 
export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    // Load environment variables server-side during local dev
    const env = loadEnv(mode, process.cwd(), '');
    Object.assign(process.env, env);
  }

  return {
    server: {
      port: 5173,
      host: true
    },
    plugins: [
      {
        name: 'pocket-frames-ai-backend',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/ai/')) {
              try {
                const { handleAiRequest } = await import('./server/api/aiRoutes.js');
                handleAiRequest(req, res, next);
              } catch (err) {
                console.error('[ViteDevServer] Error in AI middleware:', err);
                next(err);
              }
            } else {
              next();
            }
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/ai/')) {
              try {
                const { handleAiRequest } = await import('./server/api/aiRoutes.js');
                handleAiRequest(req, res, next);
              } catch (err) {
                console.error('[VitePreviewServer] Error in AI middleware:', err);
                next(err);
              }
            } else {
              next();
            }
          });
        }
      }
    ]
  };
});
