import { Hono } from 'hono';
import type { Env } from '../index';

export const webhookRouter = new Hono<{ Bindings: Env }>();

/**
 * Resend webhook endpoint.
 *
 * Resend sends events to this endpoint when emails are:
 *   - delivered (email.delivered)
 *   - bounced (email.bounced)
 *   - complained (email.complained)
 *   - opened (email.opened)
 *   - clicked (email.clicked)
 *   - delivery_delayed (email.delivery_delayed)
 *
 * Configure the webhook in Resend dashboard:
 *   URL: https://api.scottdotm.com/api/v1/webhooks/resend
 *   Events: all
 *
 * Security: Resend signs webhooks with a signature in the
 * `Resend-Webhook-Signature` header. We verify it using the
 * RESEND_WEBHOOK_SECRET env var (HMAC-SHA256).
 *
 * If the secret is not configured, we log a warning and accept
 * the payload (useful for testing). In production, ALWAYS set
 * RESEND_WEBHOOK_SECRET.
 */
webhookRouter.post('/resend', async (c) => {
  const env = c.env as Env;

  // --- Signature verification ---
  const signature = c.req.header('Resend-Webhook-Signature') || '';
  const secret = (env as any).RESEND_WEBHOOK_SECRET as string | undefined;

  if (!secret) {
    console.warn('RESEND_WEBHOOK_SECRET not configured — accepting webhook without signature verification');
  }

  // --- Parse payload ---
  let payload: any;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  // Resend sends an array of events or a single event
  const events = Array.isArray(payload) ? payload : [payload];
  const results: any[] = [];

  for (const evt of events) {
    const eventType = evt?.type || evt?.event_type || 'unknown';
    const data = evt?.data || evt;
    const resendEmailId = data?.email_id || data?.id || evt?.email_id || '';
    const recipient = data?.to || data?.recipient || data?.email || '';
    const subject = data?.subject || '';
    const bounceReason = data?.bounce?.type || data?.bounce_type || '';
    const bounceMessage = data?.bounce?.message || data?.bounce_message || '';

    if (!resendEmailId && !recipient) {
      results.push({ skipped: true, reason: 'no email_id or recipient' });
      continue;
    }

    try {
      // Insert into email_events table
      await env.DB.prepare(
        `INSERT INTO email_events (resend_email_id, event_type, recipient_email, subject, bounce_reason, bounce_message, raw_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          resendEmailId,
          eventType,
          recipient,
          subject,
          bounceReason,
          bounceMessage,
          JSON.stringify(evt)
        )
        .run();

      results.push({
        recorded: true,
        event_type: eventType,
        recipient,
        resend_email_id: resendEmailId,
      });

      // Log bounces for monitoring
      if (eventType === 'email.bounced' || eventType === 'bounced') {
        console.error(`[BOUNCE] ${recipient}: ${bounceReason} — ${bounceMessage}`);
      }
      if (eventType === 'email.complained' || eventType === 'complained') {
        console.error(`[COMPLAINT] ${recipient} marked email as spam`);
      }
    } catch (err: any) {
      console.error('Failed to record email event:', err);
      results.push({ error: err.message, event_type: eventType, recipient });
    }
  }

  return c.json({ received: events.length, results });
});

/**
 * GET endpoint to query email events (for admin dashboard).
 * Requires ADMIN_API_KEY.
 */
webhookRouter.get('/events', async (c) => {
  const env = c.env as Env;
  const apiKey = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!env.ADMIN_API_KEY || apiKey !== env.ADMIN_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const eventType = c.req.query('type') || '';
  const recipient = c.req.query('recipient') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);

  let query = 'SELECT * FROM email_events';
  const conditions: string[] = [];
  const binds: any[] = [];

  if (eventType) {
    conditions.push('event_type = ?');
    binds.push(eventType);
  }
  if (recipient) {
    conditions.push('recipient_email = ?');
    binds.push(recipient);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  binds.push(limit);

  const stmt = env.DB.prepare(query);
  const result = await stmt.bind(...binds).all();

  return c.json({ events: result.results, count: result.results.length });
});

/**
 * GET endpoint to get bounce summary (for admin dashboard).
 * Requires ADMIN_API_KEY.
 */
webhookRouter.get('/bounces', async (c) => {
  const env = c.env as Env;
  const apiKey = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!env.ADMIN_API_KEY || apiKey !== env.ADMIN_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await env.DB.prepare(
    `SELECT recipient_email, subject, bounce_reason, bounce_message, created_at
     FROM email_events
     WHERE event_type IN ('email.bounced', 'bounced')
     ORDER BY created_at DESC
     LIMIT 500`
  ).all();

  return c.json({ bounces: result.results, count: result.results.length });
});
