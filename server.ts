import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApiApp } from './server/app.ts';

const PORT =
  process.env.NODE_ENV === 'development' ? 3000 : Number(process.env.PORT) || 3000;

async function startServer() {
  const app = await createApiApp();

  // ===========================================================================
  // VITE / STATIC SERVING
  // ===========================================================================
  const distDir = path.resolve(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distDir, 'index.html'));
  const useViteDev =
    process.env.NODE_ENV === 'development' ||
    (!hasDist && process.env.NODE_ENV !== 'production');

  if (useViteDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IRON LOG running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
