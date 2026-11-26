import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const IS_VERCEL = Boolean(process.env.VERCEL);

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'ระบบจัดตารางสอน',
      storage: 'firebase-firestore',
    });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'ไม่พบ API endpoint ที่ต้องการ' });
  });

  return app;
}

export const app = createApiApp();

async function startStandaloneServer() {
  const distDir = path.resolve(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

  if (process.env.NODE_ENV !== 'production' || !hasDist) {
    const viteModule = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ viteModule);
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

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ระบบจัดตารางสอน server listening on http://0.0.0.0:${PORT}`);
  });
}

let isMainEntry = false;
try {
  if (!IS_VERCEL && process.argv[1]) {
    isMainEntry =
      fs.realpathSync(path.resolve(process.argv[1])) ===
      fs.realpathSync(fileURLToPath(import.meta.url));
  }
} catch {
  isMainEntry = false;
}

if (isMainEntry) {
  startStandaloneServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
