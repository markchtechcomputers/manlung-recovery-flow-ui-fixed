(() => {
  const form = document.getElementById('linkScanForm');
  const input = document.getElementById('urlInput');
  const button = document.getElementById('scanButton');
  const status = document.getElementById('scanStatus');
  const result = document.getElementById('scanResult');

  if (!form || !input || !button || !result || !status) return;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function showStatus(message, type = 'info') {
    status.className = `scan-status show finding-${type}`;
    status.setAttribute('role', type === 'critical' ? 'alert' : 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = message;
  }

  function hideStatus() {
    status.className = 'scan-status';
    status.textContent = '';
    status.removeAttribute('role');
  }

  function icon(level) {
    if (level === 'critical') return '🔴';
    if (level === 'warning') return '🟠';
    if (level === 'verified') return '🔵';
    if (level === 'good') return '🟢';
    return '⚪';
  }

  function renderCheck(check) {
    if (!check) return '';
    return `
      <article class="finding finding-${escapeHtml(check.status)}">
        <div class="finding-level">${icon(check.status)} ${escapeHtml(check.label)}</div>
        <div class="finding-result">${escapeHtml(check.details)}</div>
        ${Array.isArray(check.missing) && check.missing.length
          ? `<div class="finding-detail">Missing: ${check.missing.map(escapeHtml).join(', ')}</div>`
          : ''}
      </article>`;
  }

  function renderResults(data) {
    const resultInfo = data.result || {};
    const official = data.officialWebsite || { found: false };
    const checks = data.checks || {};
    const isOfficial = official.found === true;
    const isVerified = resultInfo.status === 'verified';
    const impersonation = data.impersonation || {};

    const officialHtml = isOfficial ? `
      <div class="official-box official-box-verified" role="status">
        <div class="official-badge">✓ VERIFIED OFFICIAL WEBSITE</div>
        <h3>${escapeHtml(official.name || 'Verified Official Website')}</h3>
        <p>${escapeHtml(official.description || 'This domain matches a verified official domain in the scanner directory.')}</p>
        <p><strong>Verified domain:</strong> ${escapeHtml(official.hostname || data.hostname || '')}</p>
        <a href="${escapeHtml(official.url || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(official.url || '')}</a>
        <div class="finding-detail">${escapeHtml(official.reason || '')}</div>
      </div>`
      : impersonation.status === 'critical' ? `
      <div class="official-box official-box-danger" role="alert">
        <div class="official-badge official-badge-danger">⚠ POSSIBLE CLONE / IMPERSONATION</div>
        <h3>${escapeHtml(impersonation.details || 'Possible impersonation detected')}</h3>
        <p>This domain is not in the verified official directory, but it shows signals associated with a verified organisation.</p>
        ${Array.isArray(impersonation.reasons) && impersonation.reasons.length ? `<ul class="scanner-reasons">${impersonation.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
        ${impersonation.recommendation ? `<p><strong>Recommendation:</strong> ${escapeHtml(impersonation.recommendation)}</p>` : ''}
      </div>`
      : `
      <div class="official-box">
        <strong>Official website status</strong>
        <p>This domain is not currently in the verified official-website directory. That means <strong>unverified</strong>, not automatically scam.</p>
        <div class="finding-detail">Technical scanning cannot independently prove ownership of an organisation. Verify important payment, login and contact details through an independent source.</div>
      </div>`;

    const checksHtml = Object.values(checks).map(renderCheck).join('');
    const statusCode = data.statusCode ?? 'Unknown';
    const tls = data.tls || {};
    const tlsDetail = data.scannedProtocol === 'https:'
      ? `TLS: ${tls.authorized === false ? 'certificate could not be independently trusted' : 'certificate accepted by the scanner'}`
      : '';

    result.innerHTML = `
      <div class="overall overall-${escapeHtml(resultInfo.status || 'info')} ${isVerified ? 'overall-verified' : ''}">
        <div class="overall-title">${icon(resultInfo.status)} ${escapeHtml(resultInfo.title || 'Scan complete')}</div>
        <div>${escapeHtml(resultInfo.explanation || '')}</div>
        <div class="scan-meta">
          Checked URL: ${escapeHtml(data.finalUrl || data.scannedUrl || '')}<br>
          HTTP status: ${escapeHtml(statusCode)}${tlsDetail ? `<br>${escapeHtml(tlsDetail)}` : ''}
          ${data.truncated ? '<br>Page content was safely limited to the scanner size cap.' : ''}
        </div>
      </div>
      ${officialHtml}
      <div class="findings">${checksHtml}</div>
      <div class="scanner-warning"><strong>Safety conclusion:</strong> ${escapeHtml(data.disclaimer || 'Technical checks provide evidence, not a guarantee of safety.')}</div>`;
    result.hidden = false;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const raw = input.value.trim();
    if (!raw) {
      showStatus('Enter a website address first.', 'warning');
      input.focus();
      return;
    }

    let url = raw;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS websites can be scanned.');
      if (parsed.username || parsed.password) throw new Error('URLs containing usernames or passwords are not allowed.');
      if (parsed.port && !['80', '443'].includes(parsed.port)) throw new Error('Only standard HTTP and HTTPS website ports can be scanned.');
      url = parsed.toString();
    } catch (error) {
      showStatus(error.message || 'Enter a valid website address.', 'warning');
      input.focus();
      return;
    }

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> SCANNING...';
    result.hidden = true;
    result.innerHTML = '';
    showStatus('Checking DNS, HTTPS/TLS, redirects, security headers and website signals…', 'info');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('/api/link-scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
        credentials: 'same-origin'
      });

      const rawBody = await response.text();
      let data = null;
      try { data = rawBody ? JSON.parse(rawBody) : null; } catch (_) {}

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `The website could not be checked (HTTP ${response.status}).`);
      }

      hideStatus();
      renderResults(data);
    } catch (error) {
      const message = error?.name === 'AbortError'
        ? 'The scan took too long and was stopped. Try the website again in a moment.'
        : (error?.message || 'The website could not be checked from the server.');
      showStatus(message, 'critical');
      result.hidden = true;
    } finally {
      window.clearTimeout(timeout);
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = '<i class="fas fa-magnifying-glass" aria-hidden="true"></i> SCAN WEBSITE';
    }
  });
})();
