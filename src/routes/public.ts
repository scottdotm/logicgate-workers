import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { demoReportHtml } from './demo-report';
import { fetchInquiryAndUploads, generateReportHtml } from './lake-report';
import { generateNdaaReportHtml } from './ndaa-report';

export const publicRouter = new Hono<{ Bindings: Env }>();

const inquirySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  organization: z.string().min(1),
  phone: z.string().optional(),
  part_107: z.string().optional(),
  existing_clients: z.string().optional(),
  message: z.string().optional(),
  interest: z.string().default('lake_survey_partner'),
});

const statusUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'pilot_scheduled', 'flown', 'report_delivered', 'converted', 'passed']),
});

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  department: z.enum(['mechanic', 'it', 'snow', 'lake']),
  message: z.string().min(1),
});

async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured; email skipped');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const from = env.FROM_EMAIL || 'LogicGate <info@scottdotm.com>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Resend API error:', response.status, text);
      return { success: false, error: text };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to send email:', message);
    return { success: false, error: message };
  }
}

function buildAdminNotification(data: z.infer<typeof inquirySchema>): { subject: string; html: string } {
  const subject = `New LogicGate Lake Surveys inquiry from ${data.name}`;
  const html = `
    <h2>New pilot inquiry</h2>
    <table>
      <tr><td><strong>Name</strong></td><td>${escapeHtml(data.name)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(data.email)}</td></tr>
      <tr><td><strong>Organization</strong></td><td>${escapeHtml(data.organization)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(data.phone || 'Not provided')}</td></tr>
      <tr><td><strong>Part 107</strong></td><td>${escapeHtml(data.part_107 || 'Not provided')}</td></tr>
      <tr><td><strong>Existing clients</strong></td><td>${escapeHtml(data.existing_clients || 'Not provided')}</td></tr>
      <tr><td><strong>Interest</strong></td><td>${escapeHtml(data.interest)}</td></tr>
    </table>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(data.message || 'No message provided')}</p>
  `;
  return { subject, html };
}

function buildApplicantAutoReply(name: string): { subject: string; html: string } {
  const subject = 'Thank you for applying to the LogicGate Lake Surveys pilot';
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thank you for applying to the LogicGate Lake Surveys pilot program. We received your application and will be in touch within 1–2 business days.</p>
    <p><strong>What happens next?</strong></p>
    <ul>
      <li>We’ll review your application and confirm your spot in the pilot.</li>
      <li>You’ll fly one lake using your drone; we’ll help generate the report.</li>
      <li>The pilot is 90 days, no cost, and no commitment.</li>
    </ul>
    <p>Questions? Reply to this email or contact us at <a href="mailto:info@scottdotm.com">info@scottdotm.com</a>.</p>
    <p>— LogicGate Lake Surveys</p>
  `;
  return { subject, html };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function requireAdminAuth(c: Context<{ Bindings: Env }>): string | null {
  const auth = c.req.header('Authorization');
  const key = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!c.env.ADMIN_API_KEY || key !== c.env.ADMIN_API_KEY) {
    return 'Unauthorized';
  }
  return null;
}

publicRouter.get('/health', (c) => {
  return c.json({ status: 'ok', version: '0.1.0' });
});

publicRouter.post('/inquiries', async (c) => {
  const body = await c.req.json();
  const parse = inquirySchema.safeParse(body);
  if (!parse.success) {
    return c.json({ success: false, detail: parse.error.message }, 400);
  }

  const data = parse.data;
  const result = await c.env.DB.prepare(
    'INSERT INTO inquiries (name, email, organization, phone, part_107, existing_clients, message, interest, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    data.name,
    data.email,
    data.organization,
    data.phone || null,
    data.part_107 || null,
    data.existing_clients || null,
    data.message || null,
    data.interest,
    'new'
  ).run();

  const adminEmail = c.env.ADMIN_EMAIL || 'info@scottdotm.com';
  const adminNotification = buildAdminNotification(data);
  const autoReply = buildApplicantAutoReply(data.name);

  await sendEmail(c.env, adminEmail, adminNotification.subject, adminNotification.html);
  await sendEmail(c.env, data.email, autoReply.subject, autoReply.html);

  return c.json({ success: true, id: result.meta.last_row_id });
});

function buildContactAdminEmail(data: { name: string; email: string; phone: string; department: string; message: string }): { subject: string; html: string } {
  const departmentLabel: Record<string, string> = {
    mechanic: 'DAG GUM Mobile Mechanic',
    it: 'Logic Gate IT',
    snow: 'DAG GUM Snow Removal',
    lake: 'LogicGate Lake Surveys',
  };
  const subject = `New ${departmentLabel[data.department] || 'Website'} contact from ${data.name}`;
  const html = `
    <h2>New website contact</h2>
    <table>
      <tr><td><strong>Name</strong></td><td>${escapeHtml(data.name)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(data.email)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(data.phone)}</td></tr>
      <tr><td><strong>Department</strong></td><td>${escapeHtml(departmentLabel[data.department] || data.department)}</td></tr>
    </table>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(data.message)}</p>
  `;
  return { subject, html };
}

function buildContactAutoReply(name: string): { subject: string; html: string } {
  const subject = 'We received your message — Scott M. will be in touch';
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thank you for reaching out through scottdotm.com. We received your message and will respond within 1–2 business days.</p>
    <p>If this is urgent, please call or text 262-269-4872.</p>
    <p>— Scott M. / Logic Gate IT & Dag Gum Services</p>
  `;
  return { subject, html };
}

publicRouter.post('/contact', async (c) => {
  const body = await c.req.json();
  const parse = contactSchema.safeParse(body);
  if (!parse.success) {
    return c.json({ success: false, detail: parse.error.message }, 400);
  }

  const data = parse.data;
  const adminEmail = c.env.ADMIN_EMAIL || 'info@scottdotm.com';
  const adminNotification = buildContactAdminEmail(data);
  const autoReply = buildContactAutoReply(data.name);

  await sendEmail(c.env, adminEmail, adminNotification.subject, adminNotification.html);
  await sendEmail(c.env, data.email, autoReply.subject, autoReply.html);

  return c.json({ success: true });
});

publicRouter.get('/admin/inquiries', async (c) => {
  const error = requireAdminAuth(c);
  if (error) {
    return c.json({ success: false, detail: error }, 401);
  }

  const result = await c.env.DB.prepare(
    'SELECT * FROM inquiries ORDER BY created_at DESC'
  ).all();

  return c.json({ success: true, inquiries: result.results || [] });
});

publicRouter.get('/admin/inquiries/:id', async (c) => {
  const error = requireAdminAuth(c);
  if (error) {
    return c.json({ success: false, detail: error }, 401);
  }

  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    'SELECT * FROM inquiries WHERE id = ?'
  ).bind(id).first();

  if (!result) {
    return c.json({ success: false, detail: 'Inquiry not found' }, 404);
  }

  return c.json({ success: true, inquiry: result });
});

publicRouter.put('/admin/inquiries/:id/status', async (c) => {
  const error = requireAdminAuth(c);
  if (error) {
    return c.json({ success: false, detail: error }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const parse = statusUpdateSchema.safeParse(body);
  if (!parse.success) {
    return c.json({ success: false, detail: parse.error.message }, 400);
  }

  await c.env.DB.prepare(
    'UPDATE inquiries SET status = ? WHERE id = ?'
  ).bind(parse.data.status, id).run();

  return c.json({ success: true });
});

publicRouter.get('/plans', (c) => {
  return c.json({
    plans: [
      {
        id: 'freemium',
        name: 'Freemium',
        price: 0,
        description: 'Free tier for small lake associations',
        max_assets: 1,
        max_users: 1,
        max_storage_gb: 1,
        features: ['1 lake', '1 user', 'Basic reports'],
      },
      {
        id: 'starter',
        name: 'Starter',
        price: 200,
        description: 'For small drone service providers',
        max_assets: 10,
        max_users: 3,
        max_storage_gb: 10,
        features: ['10 lakes', '3 users', 'White-label portal'],
      },
    ],
  });
});

publicRouter.post('/uploads', async (c) => {
  if (!c.env.UPLOADS) {
    return c.json({ success: false, detail: 'Uploads not configured' }, 500);
  }

  const body = await c.req.parseBody({ all: true });
  const file = body.file as File | undefined;
  const lakeName = typeof body.lake_name === 'string' ? body.lake_name : undefined;
  const inquiryId = typeof body.inquiry_id === 'string' ? parseInt(body.inquiry_id, 10) : undefined;

  if (!file || file.size === 0) {
    return c.json({ success: false, detail: 'No file provided' }, 400);
  }

  if (!file.type.startsWith('image/')) {
    return c.json({ success: false, detail: 'Only image uploads are allowed' }, 400);
  }

  const MAX_SIZE = 25 * 1024 * 1024; // 25 MiB
  if (file.size > MAX_SIZE) {
    return c.json({ success: false, detail: 'File exceeds 25 MiB limit' }, 400);
  }

  const timestamp = Date.now();
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `lakes/${lakeName ? lakeName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown'}/${timestamp}-${sanitized}`;

  await c.env.UPLOADS.put(key, file, {
    httpMetadata: { contentType: file.type },
  });

  const result = await c.env.DB.prepare(
    'INSERT INTO uploads (inquiry_id, filename, content_type, r2_key, lake_name, file_size_bytes) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    inquiryId || null,
    file.name,
    file.type,
    key,
    lakeName || null,
    file.size
  ).run();

  return c.json({ success: true, id: result.meta.last_row_id, key });
});

publicRouter.get('/uploads/:id', async (c) => {
  if (!c.env.UPLOADS) {
    return c.json({ success: false, detail: 'Uploads not configured' }, 500);
  }

  const id = c.req.param('id');
  const record = await c.env.DB.prepare(
    'SELECT r2_key, content_type FROM uploads WHERE id = ?'
  ).bind(id).first<{ r2_key: string; content_type: string }>();

  if (!record) {
    return c.json({ success: false, detail: 'Upload not found' }, 404);
  }

  const object = await c.env.UPLOADS.get(record.r2_key);
  if (!object) {
    return c.json({ success: false, detail: 'File missing from storage' }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', record.content_type || 'application/octet-stream');
  headers.set('Content-Length', String(object.size));

  return new Response(object.body, { headers });
});

publicRouter.get('/admin/uploads', async (c) => {
  const error = requireAdminAuth(c);
  if (error) {
    return c.json({ success: false, detail: error }, 401);
  }

  const result = await c.env.DB.prepare(
    'SELECT * FROM uploads ORDER BY uploaded_at DESC'
  ).all();

  return c.json({ success: true, uploads: result.results || [] });
});

async function serveLakeReport(c: Context<{ Bindings: Env }>) {
  const id = parseInt(c.req.param('inquiryId') ?? '', 10);
  if (Number.isNaN(id)) {
    return c.json({ success: false, detail: 'Invalid inquiry ID' }, 400);
  }

  const { inquiry, uploads } = await fetchInquiryAndUploads(c.env, id);
  if (!inquiry) {
    return c.json({ success: false, detail: 'Inquiry not found' }, 404);
  }

  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  return c.html(generateReportHtml(inquiry, uploads, baseUrl));
}

publicRouter.get('/reports/:inquiryId', serveLakeReport);
publicRouter.get('/lake-report/:inquiryId', serveLakeReport);

publicRouter.get('/demo-report', (c) => {
  return c.html(demoReportHtml);
});

// === NDAA Compliance Scan Upload ===

const ndaaScanSchema = z.object({
  scan_uuid: z.string().min(1),
  client_name: z.string().optional(),
  scan_date: z.string().min(1),
  subnet_scanned: z.string().min(1),
  scanner_version: z.string().optional(),
  total_devices: z.number().int().default(0),
  devices_flagged: z.number().int().default(0),
  devices_clean: z.number().int().default(0),
  discovery_only_devices: z.number().int().default(0),
  compliance_status: z.string().min(1),
  scan_report: z.record(z.unknown()),
  manifest: z.record(z.unknown()).optional(),
});

async function getClientTokenRecord(
  env: Env,
  token: string
): Promise<{ id: number; client_name: string; contact_email: string | null } | null> {
  const result = await env.DB.prepare(
    'SELECT id, client_name, contact_email FROM ndaa_client_tokens WHERE token = ? AND active = 1'
  ).bind(token).first<{ id: number; client_name: string; contact_email: string | null }>();
  return result || null;
}

publicRouter.post('/ndaa-scan', async (c) => {
  // Authenticate with client token
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return c.json({ success: false, detail: 'Missing Authorization header. Use: Bearer <client_token>' }, 401);
  }

  const tokenRecord = await getClientTokenRecord(c.env, token);
  if (!tokenRecord) {
    return c.json({ success: false, detail: 'Invalid or inactive client token' }, 403);
  }

  // Parse and validate the scan report
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, detail: 'Invalid JSON body' }, 400);
  }

  const parse = ndaaScanSchema.safeParse(body);
  if (!parse.success) {
    return c.json({ success: false, detail: parse.error.message }, 400);
  }

  const data = parse.data;

  // Extract manifest metadata if present
  let manifestJson: string | null = null;
  let manifestSha256: string | null = null;
  let manifestFingerprint: string | null = null;

  if (data.manifest) {
    manifestJson = JSON.stringify(data.manifest);
    const manifestPayload = data.manifest as Record<string, unknown>;
    const manifestData = manifestPayload.manifest as Record<string, unknown> | undefined;
    const sigData = manifestPayload.signature as Record<string, unknown> | undefined;
    if (manifestData) {
      manifestSha256 = (manifestData.scan_report_sha256 as string) || null;
      manifestFingerprint = (manifestData.public_key_fingerprint as string) || null;
    }
    // Also check signature-level fingerprint
    if (!manifestFingerprint && sigData) {
      manifestFingerprint = (sigData.public_key_fingerprint_sha256 as string) || null;
    }
  }

  // Insert into D1
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO ndaa_scans (
        scan_uuid, client_token, client_name, scan_date, subnet_scanned,
        scanner_version, total_devices, devices_flagged, devices_clean,
        discovery_only_devices, compliance_status, scan_report_json,
        manifest_json, manifest_sha256, manifest_fingerprint
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.scan_uuid,
      token,
      data.client_name || null,
      data.scan_date,
      data.subnet_scanned,
      data.scanner_version || null,
      data.total_devices,
      data.devices_flagged,
      data.devices_clean,
      data.discovery_only_devices,
      data.compliance_status,
      JSON.stringify(data.scan_report),
      manifestJson,
      manifestSha256,
      manifestFingerprint
    ).run();

    const scanId = result.meta.last_row_id;

    // Send admin notification
    const adminEmail = c.env.ADMIN_EMAIL || 'scott@scottdotm.com';
    const flaggedText = data.devices_flagged > 0
      ? `${data.devices_flagged} banned device(s) detected`
      : 'No banned devices detected';

    const adminHtml = `
      <h2>New NDAA Compliance Scan Uploaded</h2>
      <table>
        <tr><td><strong>Client</strong></td><td>${escapeHtml(data.client_name || 'Unknown')}</td></tr>
        <tr><td><strong>Scan date</strong></td><td>${escapeHtml(data.scan_date)}</td></tr>
        <tr><td><strong>Subnet</strong></td><td>${escapeHtml(data.subnet_scanned)}</td></tr>
        <tr><td><strong>Devices found</strong></td><td>${data.total_devices}</td></tr>
        <tr><td><strong>Result</strong></td><td>${escapeHtml(flaggedText)}</td></tr>
        <tr><td><strong>Compliance status</strong></td><td>${escapeHtml(data.compliance_status)}</td></tr>
        ${data.discovery_only_devices > 0 ? `<tr><td><strong>Discovery-only</strong></td><td>${data.discovery_only_devices} device(s) found via SADP/DHIP but not OUI</td></tr>` : ''}
        ${manifestSha256 ? `<tr><td><strong>Manifest SHA-256</strong></td><td>${escapeHtml(manifestSha256)}</td></tr>` : ''}
      </table>
      <p>Scan ID: ${scanId}</p>
      <p><a href="${new URL(c.req.url).origin}/api/v1/public/ndaa-scan/${scanId}/report?token=${encodeURIComponent(token)}">View HTML report</a></p>
    `;

    await sendEmail(c.env, adminEmail, `NDAA Scan uploaded: ${data.client_name || 'Unknown'} — ${flaggedText}`, adminHtml);

    // Notify the client with a direct link to their signed report
    if (tokenRecord.contact_email) {
      const reportUrl = `${new URL(c.req.url).origin}/api/v1/public/ndaa-scan/${scanId}/report?token=${encodeURIComponent(token)}`;
      const clientHtml = `
        <p>Hi ${escapeHtml(tokenRecord.client_name)},</p>
        <p>Your NDAA Section 889 compliance scan has been processed and your report is ready.</p>
        <table>
          <tr><td><strong>Scan date</strong></td><td>${escapeHtml(data.scan_date)}</td></tr>
          <tr><td><strong>Devices scanned</strong></td><td>${data.total_devices}</td></tr>
          <tr><td><strong>Result</strong></td><td>${escapeHtml(flaggedText)}</td></tr>
          ${manifestSha256 ? `<tr><td><strong>Signed manifest SHA-256</strong></td><td>${escapeHtml(manifestSha256)}</td></tr>` : ''}
        </table>
        <p><a href="${reportUrl}">View your compliance report</a></p>
        <p>This link is private to your organization. The report includes a print-to-PDF option and, where applicable, a cryptographically signed compliance manifest that any third party can verify independently.</p>
        <p>Questions? Reply to this email or contact <a href="mailto:scott@scottdotm.com">scott@scottdotm.com</a>.</p>
        <p>— Logic Gate IT NDAA Compliance Scanning</p>
      `;
      await sendEmail(
        c.env,
        tokenRecord.contact_email,
        `Your NDAA compliance scan report is ready — ${flaggedText}`,
        clientHtml
      );
    }

    return c.json({
      success: true,
      scan_id: scanId,
      scan_uuid: data.scan_uuid,
      message: 'Scan uploaded successfully. Report will be available at the portal.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to store NDAA scan:', message);
    return c.json({ success: false, detail: 'Failed to store scan: ' + message }, 500);
  }
});

publicRouter.get('/ndaa-scan/:id', async (c) => {
  const id = c.req.param('id');

  // Allow access with either admin auth or client token
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  const result = await c.env.DB.prepare(
    'SELECT * FROM ndaa_scans WHERE id = ? OR scan_uuid = ?'
  ).bind(id, id).first();

  if (!result) {
    return c.json({ success: false, detail: 'Scan not found' }, 404);
  }

  // Verify access: admin key or matching client token
  const isAdmin = c.env.ADMIN_API_KEY && token === c.env.ADMIN_API_KEY;
  const isClient = token && token === result.client_token;

  if (!isAdmin && !isClient) {
    return c.json({ success: false, detail: 'Unauthorized to view this scan' }, 403);
  }

  // Parse the stored JSON fields
  const scanReport = result.scan_report_json ? JSON.parse(result.scan_report_json as string) : null;
  const manifest = result.manifest_json ? JSON.parse(result.manifest_json as string) : null;

  return c.json({
    success: true,
    scan: {
      id: result.id,
      scan_uuid: result.scan_uuid,
      client_name: result.client_name,
      scan_date: result.scan_date,
      subnet_scanned: result.subnet_scanned,
      scanner_version: result.scanner_version,
      total_devices: result.total_devices,
      devices_flagged: result.devices_flagged,
      devices_clean: result.devices_clean,
      discovery_only_devices: result.discovery_only_devices,
      compliance_status: result.compliance_status,
      manifest_sha256: result.manifest_sha256,
      manifest_fingerprint: result.manifest_fingerprint,
      uploaded_at: result.uploaded_at,
      scan_report: scanReport,
      manifest: manifest,
    }
  });
});

publicRouter.get('/ndaa-scan/:id/report', async (c) => {
  const id = c.req.param('id');

  // Allow access with admin key or client token, via header or ?token= (for email links)
  const auth = c.req.header('Authorization');
  const headerToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const token = headerToken || c.req.query('token') || null;

  const result = await c.env.DB.prepare(
    'SELECT * FROM ndaa_scans WHERE id = ? OR scan_uuid = ?'
  ).bind(id, id).first();

  if (!result) {
    return c.json({ success: false, detail: 'Scan not found' }, 404);
  }

  const isAdmin = c.env.ADMIN_API_KEY && token === c.env.ADMIN_API_KEY;
  const isClient = token && token === result.client_token;

  if (!isAdmin && !isClient) {
    return c.json({ success: false, detail: 'Unauthorized to view this scan' }, 403);
  }

  const scanReport = result.scan_report_json ? JSON.parse(result.scan_report_json as string) : null;

  return c.html(generateNdaaReportHtml(
    {
      id: result.id as number,
      scan_uuid: result.scan_uuid as string,
      client_name: result.client_name as string | null,
      scan_date: result.scan_date as string,
      subnet_scanned: result.subnet_scanned as string,
      scanner_version: result.scanner_version as string | null,
      total_devices: result.total_devices as number,
      devices_flagged: result.devices_flagged as number,
      devices_clean: result.devices_clean as number,
      discovery_only_devices: result.discovery_only_devices as number,
      compliance_status: result.compliance_status as string,
      manifest_sha256: result.manifest_sha256 as string | null,
      manifest_fingerprint: result.manifest_fingerprint as string | null,
      uploaded_at: result.uploaded_at as string,
    },
    scanReport
  ));
});

publicRouter.get('/admin/ndaa-scans', async (c) => {
  const error = requireAdminAuth(c);
  if (error) {
    return c.json({ success: false, detail: error }, 401);
  }

  const result = await c.env.DB.prepare(
    'SELECT id, scan_uuid, client_name, scan_date, subnet_scanned, total_devices, devices_flagged, compliance_status, uploaded_at FROM ndaa_scans ORDER BY uploaded_at DESC'
  ).all();

  return c.json({ success: true, scans: result.results || [] });
});

// Create a new client token (admin only)
publicRouter.post('/admin/ndaa-tokens', async (c) => {
  const error = requireAdminAuth(c);
  if (error) {
    return c.json({ success: false, detail: error }, 401);
  }

  const body = await c.req.json();
  const tokenSchema = z.object({
    client_name: z.string().min(1),
    contact_email: z.string().email().optional(),
  });

  const parse = tokenSchema.safeParse(body);
  if (!parse.success) {
    return c.json({ success: false, detail: parse.error.message }, 400);
  }

  // Generate a random token
  const token = crypto.randomUUID() + '-' + crypto.randomUUID();

  const result = await c.env.DB.prepare(
    'INSERT INTO ndaa_client_tokens (token, client_name, contact_email) VALUES (?, ?, ?)'
  ).bind(token, parse.data.client_name, parse.data.contact_email || null).run();

  return c.json({
    success: true,
    token_id: result.meta.last_row_id,
    token,
    client_name: parse.data.client_name,
    message: 'Save this token securely. It is needed to upload scans for this client.',
  });
});

publicRouter.get('/admin/ndaa-tokens', async (c) => {
  const error = requireAdminAuth(c);
  if (error) {
    return c.json({ success: false, detail: error }, 401);
  }

  const result = await c.env.DB.prepare(
    'SELECT id, token, client_name, contact_email, active, created_at FROM ndaa_client_tokens ORDER BY created_at DESC'
  ).all();

  return c.json({ success: true, tokens: result.results || [] });
});
