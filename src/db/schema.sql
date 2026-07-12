-- Inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  phone TEXT,
  part_107 TEXT,
  existing_clients TEXT,
  message TEXT,
  interest TEXT DEFAULT 'lake_survey_partner',
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Future tenant/lake tables
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  plan TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Uploads table for R2 image storage linked to pilot inquiries
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inquiry_id INTEGER,
  filename TEXT NOT NULL,
  content_type TEXT,
  r2_key TEXT NOT NULL,
  lake_name TEXT,
  file_size_bytes INTEGER,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id)
);

-- NDAA compliance scan results
CREATE TABLE IF NOT EXISTS ndaa_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_uuid TEXT NOT NULL UNIQUE,
  client_token TEXT NOT NULL,
  client_name TEXT,
  scan_date TEXT NOT NULL,
  subnet_scanned TEXT NOT NULL,
  scanner_version TEXT,
  total_devices INTEGER DEFAULT 0,
  devices_flagged INTEGER DEFAULT 0,
  devices_clean INTEGER DEFAULT 0,
  discovery_only_devices INTEGER DEFAULT 0,
  compliance_status TEXT NOT NULL,
  scan_report_json TEXT NOT NULL,
  manifest_json TEXT,
  manifest_sha256 TEXT,
  manifest_fingerprint TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- NDAA scan client tokens (for authenticating scan uploads)
CREATE TABLE IF NOT EXISTS ndaa_client_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  contact_email TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Email events from Resend webhooks (bounces, deliveries, opens, clicks, etc.)
CREATE TABLE IF NOT EXISTS email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resend_email_id TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- delivered, bounced, complained, opened, clicked, delivery_delayed
  recipient_email TEXT NOT NULL,
  subject TEXT,
  campaign TEXT,                     -- which campaign file this belongs to
  prospect_id TEXT,                  -- prospect ID from campaign JSON
  bounce_reason TEXT,                -- for bounced: permanent / transient
  bounce_message TEXT,               -- for bounced: SMTP error message
  raw_payload TEXT,                  -- full webhook payload as JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON email_events(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON email_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);

