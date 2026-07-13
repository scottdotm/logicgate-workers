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
 * Security: Resend uses Svix to sign webhooks. Required headers are
 * `svix-id`, `svix-timestamp`, and `svix-signature`. We verify the
 * HMAC-SHA256 signature using the RESEND_WEBHOOK_SECRET env var.
 *
 * If the secret is not configured, we log a warning and accept
 * the payload (useful for testing). In production, ALWAYS set
 * RESEND_WEBHOOK_SECRET.
 */
function base64Decode(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifySvixWebhook(
  payload: string,
  headers: { id?: string | undefined; timestamp?: string | undefined; signature?: string | undefined },
  secret: string
): Promise<boolean> {
  if (!secret.startsWith('whsec_')) {
    return false;
  }
  const timestamp = headers.timestamp;
  const signature = headers.signature;
  if (!timestamp || !signature) {
    return false;
  }

  const keyBytes = base64Decode(secret.slice('whsec_'.length));
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const message = new TextEncoder().encode(`${timestamp}.${payload}`);
  const signatures = signature.split(' ').filter(Boolean);

  for (const sig of signatures) {
    const [version, value] = sig.split(',');
    if (version !== 'v1' || !value) {
      continue;
    }
    const sigBytes = base64Decode(value);
    const valid = await crypto.subtle.verify(
      { name: 'HMAC', hash: 'SHA-256' },
      key,
      sigBytes,
      message
    );
    if (valid) {
      return true;
    }
  }

  return false;
}

webhookRouter.post('/resend', async (c) => {
  const env = c.env as Env;

  // --- Signature verification ---
  // Resend uses Svix to sign webhooks. Required headers:
  //   svix-id, svix-timestamp, svix-signature
  // The secret is the value shown in the Resend dashboard (starts with whsec_).
  const secret = env.RESEND_WEBHOOK_SECRET;
  const rawPayload = await c.req.text();

  if (!secret) {
    console.warn('RESEND_WEBHOOK_SECRET not configured — accepting webhook without signature verification');
  } else {
    const verified = await verifySvixWebhook(rawPayload, {
      id: c.req.header('svix-id'),
      timestamp: c.req.header('svix-timestamp'),
      signature: c.req.header('svix-signature'),
    }, secret);
    if (!verified) {
      return c.json({ error: 'Invalid webhook signature' }, 400);
    }
  }

  // --- Parse payload ---
  let payload: any;
  try {
    payload = JSON.parse(rawPayload);
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
