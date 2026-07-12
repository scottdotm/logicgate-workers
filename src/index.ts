import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { publicRouter } from './routes/public';
import { webhookRouter } from './routes/webhooks';

export type Env = {
  DB: D1Database;
  UPLOADS?: R2Bucket;  // R2 not enabled yet; enable when ready for image uploads
  ALLOWED_ORIGINS: string;
  RESEND_API_KEY?: string;
  RESEND_WEBHOOK_SECRET?: string;
  ADMIN_EMAIL?: string;
  FROM_EMAIL?: string;
  ADMIN_API_KEY?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const origins = c.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const corsMiddleware = cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.get('/', (c) => c.json({ status: 'LogicGate Workers API' }));
app.route('/api/v1/public', publicRouter);
app.route('/api/v1/webhooks', webhookRouter);

export default app;
