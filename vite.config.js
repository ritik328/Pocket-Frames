import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
 
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
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          aiDirector: resolve(__dirname, 'ai-director.html'),
          studio: resolve(__dirname, 'studio.html')
        }
      }
    },
    plugins: [
      {
        name: 'pocket-frames-ai-backend',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && (req.url.startsWith('/api/stickers') || req.url.startsWith('/api/stickers/'))) {
              try {
                const { handleStickerRequest } = await import('./server/api/stickerRoutes.js');
                handleStickerRequest(req, res, next);
              } catch (err) {
                console.error('[ViteDevServer] Error in Stickers middleware:', err);
                next(err);
              }
            } else if (req.url && req.url.startsWith('/api/ai/')) {
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
            if (req.url && (req.url.startsWith('/api/stickers') || req.url.startsWith('/api/stickers/'))) {
              try {
                const { handleStickerRequest } = await import('./server/api/stickerRoutes.js');
                handleStickerRequest(req, res, next);
              } catch (err) {
                console.error('[VitePreviewServer] Error in Stickers middleware:', err);
                next(err);
              }
            } else if (req.url && req.url.startsWith('/api/ai/')) {
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
