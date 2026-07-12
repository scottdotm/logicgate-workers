export const demoReportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sample Lake Survey Report</title>
  <style>
    :root { --accent: #00f2ff; --bg: #050505; --card: #111; --text: #e0e0e0; }
    body { font-family: 'Space Grotesk', system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 2rem; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; }
    header { border-bottom: 1px solid var(--accent); padding-bottom: 1rem; margin-bottom: 2rem; }
    h1 { color: var(--accent); margin: 0; font-size: 2rem; }
    .subtitle { color: #888; margin-top: 0.5rem; }
    .card { background: var(--card); border: 1px solid rgba(0,242,255,0.2); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    h2 { color: var(--accent); margin-top: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.6rem; border-bottom: 1px solid #333; }
    th { color: var(--accent); width: 35%; }
    .image-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .image-card { background: var(--card); border: 1px solid rgba(0,242,255,0.2); border-radius: 8px; padding: 1rem; text-align: center; }
    .placeholder { width: 100%; height: 140px; background: #1a1a1a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #666; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .footer { text-align: center; color: #666; margin-top: 3rem; font-size: 0.85rem; }
    .print-btn { display: inline-block; background: var(--accent); color: #000; padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; margin-bottom: 2rem; }
    .badge { display: inline-block; background: rgba(0,242,255,0.15); color: var(--accent); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; margin-right: 0.5rem; }
    .summary-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
    .summary-box { background: rgba(0,0,0,0.3); border: 1px solid #333; border-radius: 8px; padding: 1rem; text-align: center; }
    .summary-box .number { font-size: 1.5rem; color: var(--accent); font-weight: bold; }
    .summary-box .label { font-size: 0.8rem; color: #888; }
    ul.action-list { list-style: none; padding: 0; }
    ul.action-list li { padding: 0.5rem 0; border-bottom: 1px solid #333; }
  </style>
  <script>
    (function() {
      function loadGtag() {
        if (window.__gtagLoaded) return;
        window.__gtagLoaded = true;
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-8L4KYBYJBJ';
        document.head.appendChild(script);
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());
        gtag('config', 'G-8L4KYBYJBJ', { anonymize_ip: true });
        window.gtag = gtag;
      }
      const consent = localStorage.getItem('lakeSurveysCookieConsent');
      if (consent === 'granted') {
        loadGtag();
      }
    })();
  </script>
</head>
<body>
  <div class="container">
    <div style="text-align: right; margin-bottom: 1rem;">
      <a class="print-btn" href="javascript:window.print()">Print / Save as PDF</a>
    </div>
    <header>
      <h1>LogicGate Lake Survey Report</h1>
      <p class="subtitle">Sample report for demonstration purposes</p>
    </header>

    <div class="card">
      <span class="badge">Spring Survey</span>
      <span class="badge">White-Label Ready</span>
      <h2 style="margin-top: 1rem;">Lake Information</h2>
      <table>
        <tr><th>Lake Name</th><td>Mirror Lake</td></tr>
        <tr><th>Location</th><td>Oconomowoc, Waukesha County, WI</td></tr>
        <tr><th>Body ID</th><td>WI-WK-042</td></tr>
        <tr><th>Area</th><td>187 acres</td></tr>
        <tr><th>Association</th><td>Mirror Lake Property Owners Association</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>Survey Summary</h2>
      <div class="summary-row">
        <div class="summary-box"><div class="number">52</div><div class="label">Images captured</div></div>
        <div class="summary-box"><div class="number">3.2 mi</div><div class="label">Shoreline covered</div></div>
        <div class="summary-box"><div class="number">8</div><div class="label">Vegetation beds mapped</div></div>
        <div class="summary-box"><div class="number">2</div><div class="label">Inlets documented</div></div>
      </div>
      <table>
        <tr><th>Survey Date</th><td>June 15, 2026</td></tr>
        <tr><th>Pilot / Provider</th><td>Northshore Drone Services</td></tr>
        <tr><th>Drone</th><td>DJI Mavic 3 Enterprise</td></tr>
        <tr><th>Altitude</th><td>120 ft AGL</td></tr>
        <tr><th>Weather</th><td>Clear, wind 8 mph</td></tr>
        <tr><th>Status</th><td>Completed</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>Shoreline & Vegetation Observations</h2>
      <p><strong>North Shore:</strong> Stable riprap along most of the north shore. One 15-foot section of exposed soil noted near GPS 43.1112, -88.4987. Recommended for seeding and matting before fall rains.</p>
      <p><strong>East Inlet:</strong> Moderate cattail encroachment extending approximately 20 feet from the channel. No open-water obstruction at time of survey.</p>
      <p><strong>South Cove:</strong> Clear water with visible submerged vegetation. No invasive species identified from imagery; recommend ground-truthing if concerns remain.</p>
      <p><strong>West Shore:</strong> Two new docks under construction. Construction mats present; no visible sediment plume.</p>
    </div>

    <div class="card">
      <h2>Sample Images</h2>
      <div class="image-grid">
        <div class="image-card">
          <div class="placeholder">[North shoreline — stable riprap]</div>
          <div>GPS: 43.1112, -88.4987</div>
        </div>
        <div class="image-card">
          <div class="placeholder">[East inlet — cattail encroachment]</div>
          <div>GPS: 43.1105, -88.4972</div>
        </div>
        <div class="image-card">
          <div class="placeholder">[South cove — submerged vegetation]</div>
          <div>GPS: 43.1098, -88.4995</div>
        </div>
        <div class="image-card">
          <div class="placeholder">[West shore — dock construction]</div>
          <div>GPS: 43.1101, -88.5008</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Recommended Actions</h2>
      <ul class="action-list">
        <li><strong>Monitor north shore erosion:</strong> Re-image after heavy rain events to track progression.</li>
        <li><strong>Schedule cattail management:</strong> East inlet may need treatment before fall to prevent spring spread.</li>
        <li><strong>Ground-truth south cove:</strong> Confirm submerged vegetation species and density.</li>
        <li><strong>Document dock completion:</strong> Re-survey after construction to update baseline imagery.</li>
      </ul>
    </div>

    <div class="card">
      <h2>Notes</h2>
      <p>This is a sample report generated for demonstration purposes. A real report uses GPS-tagged images, telemetry, and lake metadata from the actual drone survey. A fall comparison survey is recommended to track seasonal changes.</p>
    </div>

    <div class="footer">
      Generated by LogicGate Lake Surveys | scottdotm.com<br>
      White-label report for Northshore Drone Services
    </div>
  </div>

  <div id="cookieConsent" class="cookie-consent" style="position: fixed; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.9); border-top: 1px solid rgba(0,242,255,0.3); color: #e0e0e0; padding: 1rem 2rem; display: none; z-index: 1000;">
    <div style="max-width: 900px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
      <p style="margin: 0; font-size: 0.9rem;">We use cookies to understand how visitors use this sample report. <a href="https://scottdotm.com/privacy/" style="color: #00f2ff;">Learn more</a>.</p>
      <div style="display: flex; gap: 0.5rem;">
        <button id="acceptCookies" type="button" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; background: #00f2ff; color: #000;">Accept</button>
        <button id="declineCookies" type="button" style="padding: 8px 16px; border: 1px solid rgba(0,242,255,0.3); border-radius: 4px; cursor: pointer; font-weight: bold; background: transparent; color: #e0e0e0;">Decline</button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      const banner = document.getElementById('cookieConsent');
      const acceptBtn = document.getElementById('acceptCookies');
      const declineBtn = document.getElementById('declineCookies');
      const consent = localStorage.getItem('lakeSurveysCookieConsent');

      function loadGtag() {
        if (window.__gtagLoaded) return;
        window.__gtagLoaded = true;
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-8L4KYBYJBJ';
        document.head.appendChild(script);
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());
        gtag('config', 'G-8L4KYBYJBJ', { anonymize_ip: true });
        window.gtag = gtag;
      }

      if (consent === 'granted') {
        loadGtag();
      } else if (consent !== 'denied') {
        banner.style.display = 'block';
      }

      acceptBtn.addEventListener('click', function() {
        localStorage.setItem('lakeSurveysCookieConsent', 'granted');
        loadGtag();
        banner.style.display = 'none';
      });

      declineBtn.addEventListener('click', function() {
        localStorage.setItem('lakeSurveysCookieConsent', 'denied');
        banner.style.display = 'none';
      });
    })();
  </script>
</body>
</html>`;
