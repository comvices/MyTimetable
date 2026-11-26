import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from '../server';

type VercelLikeRequest = IncomingMessage & {
  url?: string;
  body?: unknown;
  _body?: boolean;
};

export default function handler(req: VercelLikeRequest, res: ServerResponse) {
  try {
    const rawUrl = req.url || '/';
    const parsed = new URL(rawUrl, 'http://localhost');
    const routeParam = parsed.searchParams.get('__route');

    if (routeParam !== null) {
      parsed.searchParams.delete('__route');
      const cleanRoute = routeParam.replace(/^\/+/, '');
      const qs = parsed.searchParams.toString();
      req.url = `/api${cleanRoute ? `/${cleanRoute}` : ''}${qs ? `?${qs}` : ''}`;
    } else if (!parsed.pathname.startsWith('/api')) {
      const cleanPath = parsed.pathname.replace(/^\/+/, '');
      const qs = parsed.searchParams.toString();
      req.url = `/api${cleanPath ? `/${cleanPath}` : ''}${qs ? `?${qs}` : ''}`;
    }

    // If Vercel runtime pre-parsed req.body, tell Express body-parser not to re-read the stream
    if (req.body !== undefined) {
      if (
        typeof req.body === 'string' &&
        typeof req.headers['content-type'] === 'string' &&
        req.headers['content-type'].includes('application/json')
      ) {
        try {
          req.body = JSON.parse(req.body);
        } catch {
          // Keep original body if JSON parsing fails
        }
      }
      req._body = true;
    }

    return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
  } catch (err) {
    console.error('Vercel API handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }));
  }
}
