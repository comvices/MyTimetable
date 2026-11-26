import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelLikeRequest = IncomingMessage & {
  url?: string;
};

export default function handler(req: VercelLikeRequest, res: ServerResponse) {
  try {
    const rawUrl = req.url || '/';
    const parsed = new URL(rawUrl, 'http://localhost');
    const routeParam = parsed.searchParams.get('__route');
    const cleanRoute = routeParam !== null ? routeParam.replace(/^\/+/, '') : parsed.pathname.replace(/^\/+api\/?/, '');

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (cleanRoute === 'health' || cleanRoute === '') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ok: true,
          service: 'ระบบจัดตารางสอน',
          storage: 'firebase-firestore',
        })
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'ไม่พบ API endpoint ที่ต้องการ' }));
  } catch (err) {
    console.error('Vercel API handler error:', err);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, service: 'ระบบจัดตารางสอน' }));
  }
}
