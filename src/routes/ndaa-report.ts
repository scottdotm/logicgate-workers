type ScanRow = {
  id: number;
  scan_uuid: string;
  client_name: string | null;
  scan_date: string;
  subnet_scanned: string;
  scanner_version: string | null;
  total_devices: number;
  devices_flagged: number;
  devices_clean: number;
  discovery_only_devices: number;
  compliance_status: string;
  manifest_sha256: string | null;
  manifest_fingerprint: string | null;
  uploaded_at: string;
};

type FlaggedDevice = {
  ip?: string;
  mac?: string;
  hostname?: string | null;
  vendor_name?: string;
  match_method?: string;
  ban_reference?: string;
  site?: string;
};

type ScanReport = {
  scan_metadata?: {
    scanner?: string;
    version?: string;
    scan_date?: string;
    scan_duration_seconds?: number;
    subnet_scanned?: string;
    statute?: string;
  };
  summary?: {
    total_devices_found?: number;
    devices_flagged?: number;
    devices_clean?: number;
    discovery_only_devices?: number;
    risk_level?: string;
  };
  flagged_devices?: FlaggedDevice[];
  discovery_only_devices?: FlaggedDevice[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function deviceRows(devices: FlaggedDevice[]): string {
  return devices
    .map(
      (d) => `
      <tr>
        <td>${escapeHtml(d.ip || 'Unknown')}</td>
        <td>${escapeHtml(d.mac || 'Unknown')}</td>
        <td>${escapeHtml(d.hostname || '—')}</td>
        <td>${escapeHtml(d.vendor_name || 'Unknown')}</td>
        <td>${escapeHtml(d.match_method || '—')}</td>
        <td>${escapeHtml(d.ban_reference || '—')}</td>
      </tr>`
    )
    .join('');
}

export function generateNdaaReportHtml(scan: ScanRow, report: ScanReport | null): string {
  const flagged = report?.flagged_devices || [];
  const discoveryOnly = report?.discovery_only_devices || [];
  const riskLevel =
    report?.summary?.risk_level ||
    (scan.devices_flagged > 0 ? 'ATTENTION REQUIRED' : 'NO BANNED VENDOR SIGNATURES');
  const isClean = scan.devices_flagged === 0;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>NDAA Section 889 Compliance Scan Report — ${escapeHtml(scan.client_name || scan.scan_uuid)}</title>
    <style>
      body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
      h1 { color: #1a365d; border-bottom: 2px solid #2c5282; padding-bottom: 0.5rem; }
      h2 { color: #2c5282; margin-top: 2rem; }
      .status-banner { border-radius: 12px; padding: 1.2rem 1.5rem; margin: 1.5rem 0; font-size: 1.1rem; font-weight: 600; }
      .status-clean { background: #f0fff4; border: 1px solid #38a169; color: #22543d; }
      .status-flagged { background: #fff5f5; border: 1px solid #e53e3e; color: #742a2a; }
      .meta { background: #f4f4f4; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; }
      .meta-row { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #e0e0e0; }
      .meta-row:last-child { border-bottom: none; }
      .label { font-weight: 600; color: #555; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
      th { background: #edf2f7; text-align: left; padding: 0.6rem; border: 1px solid #cbd5e0; }
      td { padding: 0.6rem; border: 1px solid #e2e8f0; }
      .placeholder { background: #fafafa; border: 2px dashed #ccc; border-radius: 12px; padding: 2rem; text-align: center; color: #666; }
      .disclaimer { background: #fffbeb; border: 1px solid #d69e2e; border-radius: 12px; padding: 1.2rem; margin: 2rem 0; font-size: 0.9rem; color: #744210; }
      .manifest { background: #ebf8ff; border: 1px solid #3182ce; border-radius: 12px; padding: 1.2rem; margin: 1.5rem 0; font-size: 0.9rem; word-break: break-all; }
      .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e0e0e0; font-size: 0.85rem; color: #666; }
      .print-btn { position: fixed; top: 1rem; right: 1rem; background: #1a365d; color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1.2rem; font-size: 0.9rem; cursor: pointer; }
      .print-btn:hover { background: #2c5282; }
      @media print { .print-btn { display: none; } body { padding: 0; } }
    </style>
  </head>
  <body>
    <button class="print-btn" onclick="window.print()">Download PDF</button>
    <h1>NDAA Section 889 Compliance Scan Report</h1>

    <div class="status-banner ${isClean ? 'status-clean' : 'status-flagged'}">
      ${isClean ? '✓' : '⚠'} ${escapeHtml(riskLevel)} — ${scan.devices_flagged} of ${scan.total_devices} device(s) flagged
    </div>

    <div class="meta">
      <div class="meta-row"><span class="label">Client</span><span>${escapeHtml(scan.client_name || 'Not specified')}</span></div>
      <div class="meta-row"><span class="label">Scan ID</span><span>${escapeHtml(scan.scan_uuid)}</span></div>
      <div class="meta-row"><span class="label">Scan date</span><span>${escapeHtml(scan.scan_date)}</span></div>
      <div class="meta-row"><span class="label">Subnet scanned</span><span>${escapeHtml(scan.subnet_scanned)}</span></div>
      <div class="meta-row"><span class="label">Scanner version</span><span>${escapeHtml(scan.scanner_version || 'Unknown')}</span></div>
      <div class="meta-row"><span class="label">Total devices found</span><span>${scan.total_devices}</span></div>
      <div class="meta-row"><span class="label">Devices flagged</span><span>${scan.devices_flagged}</span></div>
      <div class="meta-row"><span class="label">Devices with no banned signatures</span><span>${scan.devices_clean}</span></div>
      <div class="meta-row"><span class="label">Discovery-only detections</span><span>${scan.discovery_only_devices}</span></div>
      <div class="meta-row"><span class="label">Compliance status</span><span>${escapeHtml(scan.compliance_status)}</span></div>
      <div class="meta-row"><span class="label">Uploaded</span><span>${escapeHtml(scan.uploaded_at)}</span></div>
    </div>

    <h2>Flagged Devices</h2>
    ${
      flagged.length > 0
        ? `<table>
        <thead>
          <tr><th>IP</th><th>MAC</th><th>Hostname</th><th>Vendor</th><th>Match method</th><th>Ban reference</th></tr>
        </thead>
        <tbody>${deviceRows(flagged)}</tbody>
      </table>`
        : '<div class="placeholder">No devices matching banned vendor signatures were detected.</div>'
    }

    ${
      discoveryOnly.length > 0
        ? `<h2>Discovery-Only Detections</h2>
      <p>These devices responded to Hikvision SADP or Dahua DHIP discovery probes but did not match a banned OUI prefix. They are the most important findings, as they represent rebranded or OEM devices that a MAC-only scan would miss.</p>
      <table>
        <thead>
          <tr><th>IP</th><th>MAC</th><th>Hostname</th><th>Vendor</th><th>Match method</th><th>Ban reference</th></tr>
        </thead>
        <tbody>${deviceRows(discoveryOnly)}</tbody>
      </table>`
        : ''
    }

    ${
      scan.manifest_sha256
        ? `<h2>Cryptographic Compliance Manifest</h2>
      <div class="manifest">
        <strong>Report SHA-256:</strong> ${escapeHtml(scan.manifest_sha256)}<br />
        ${scan.manifest_fingerprint ? `<strong>Signing key fingerprint:</strong> ${escapeHtml(scan.manifest_fingerprint)}<br />` : ''}
        This scan report is covered by an Ed25519-signed compliance manifest. Any third party can verify the manifest against the public key embedded in it without contacting Logic Gate IT.
      </div>`
        : ''
    }

    <div class="disclaimer">
      <strong>Important:</strong> This report documents technical observations only (MAC OUI, HTTP/SNMP banners, discovery protocol responses). It is not a legal determination of NDAA Section 889 compliance and is not a federal certification. MAC addresses can be spoofed and devices can be rebranded. Verify findings manually and consult legal counsel for compliance questions.
    </div>

    <div class="footer">
      Generated by Logic Gate IT NDAA Compliance Scanning · NDAA Section 889 (Public Law 116-92) · ${new Date().toLocaleDateString()}
    </div>
  </body>
</html>`;
}
