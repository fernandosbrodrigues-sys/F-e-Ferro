import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest } from '../server/router';

// Vercel must leave the request body untouched so it can be converted to a Web Request.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const host = req.headers.host || 'localhost';
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const requestUrl = new URL(req.url || '/', `${proto}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      } else if (typeof value === 'string') {
        headers.set(key, value);
      }
    }

    let bodyText: string | undefined;
    if (!['GET', 'HEAD'].includes((req.method || 'GET').toUpperCase())) {
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > 1024 * 1024) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Corpo da requisição muito grande.' }));
          return;
        }
        chunks.push(buffer);
      }
      bodyText = Buffer.concat(chunks).toString('utf8');
    }

    const webRequest = new Request(requestUrl, {
      method: req.method || 'GET',
      headers,
      ...(bodyText !== undefined ? { body: bodyText } : {}),
    });

    const webResponse = await handleApiRequest(webRequest);
    res.statusCode = webResponse.status;

    const cookies =
      typeof webResponse.headers.getSetCookie === 'function'
        ? webResponse.headers.getSetCookie()
        : [];
    webResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
    });
    if (cookies.length > 0) res.setHeader('Set-Cookie', cookies);

    res.end(Buffer.from(await webResponse.arrayBuffer()));
  } catch (error) {
    console.error('Vercel API adapter error:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Erro interno do servidor.' }));
    }
  }
}
