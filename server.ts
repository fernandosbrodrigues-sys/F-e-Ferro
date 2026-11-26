import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { handleApiRequest } from './server/router.ts';

const PORT =
  process.env.NODE_ENV === 'development' ? 3000 : Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.set('trust proxy', true);

  app.use('/api', async (req: Request, res: Response) => {
    try {
      const host = req.get('host') || `localhost:${PORT}`;
      const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
      const url = `${proto}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (Array.isArray(val)) {
          for (const v of val) headers.append(key, v);
        } else if (typeof val === 'string') {
          headers.set(key, val);
        }
      }

      let bodyText: string | undefined;
      if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) {
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of req) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buf.length;
          if (total > 1024 * 1024) {
            res.status(413).json({ error: 'Corpo da requisição muito grande.' });
            return;
          }
          chunks.push(buf);
        }
        bodyText = Buffer.concat(chunks).toString('utf8');
      }

      const webReq = new globalThis.Request(url, {
        method: req.method,
        headers,
        ...(bodyText !== undefined ? { body: bodyText } : {}),
      });

      const webRes = await handleApiRequest(webReq);
      res.status(webRes.status);

      const setCookies =
        typeof webRes.headers.getSetCookie === 'function' ? webRes.headers.getSetCookie() : [];
      webRes.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') {
          res.setHeader(key, value);
        }
      });
      if (setCookies.length > 0) {
        res.setHeader('Set-Cookie', setCookies);
      }

      const out = Buffer.from(await webRes.arrayBuffer());
      res.send(out);
    } catch (err) {
      console.error('Server Adapter Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro interno do servidor.' });
      }
    }
  });

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
    console.log(`FÉ & FERRO running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
