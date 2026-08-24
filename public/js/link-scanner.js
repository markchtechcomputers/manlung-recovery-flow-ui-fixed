(() => {
  const form = document.getElementById('linkScanForm');
  const input = document.getElementById('urlInput');
  const button = document.getElementById('scanButton');
  const status = document.getElementById('scanStatus');
  const result = document.getElementById('scanResult');

  if (!form || !input || !button || !result) return;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function showStatus(message, type = 'info') {
    status.className = `scan-status show finding-${type}`;
    status.textContent = message;
  }

  function hideStatus() {
    status.className = 'scan-status';
    status.textContent = '';
  }

  function icon(level) {
    if (level === 'critical') return '🔴';
    if (level === 'warning') return '🟠';
    if (level === 'verified') return '🔵';
    if (level === 'good') return '🟢';
    return '⚪';
  }

  function renderCheck(key, check) {
    if (!check) return '';
    return `
      <article class="finding finding-${escapeHtml(check.status)}">
        <div class="finding-level">${icon(check.status)} ${escapeHtml(check.label)}</div>
        <div class="finding-result">${escapeHtml(check.details)}</div>
        ${Array.isArray(check.missing) && check.missing.length
          ? `<div class="finding-detail">Missing: ${check.missing.map(escapeHtml).join(', ')}</div>`
          : ''}
      </article>
    `;
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
        <p>${escapeHtml(official.description || 'This domain belongs to a verified official domain in the scanner directory.')}</p>
        <p><strong>Verified domain:</strong> ${escapeHtml(official.hostname || data.hostname || '')}</p>
        <a href="${escapeHtml(official.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(official.url)}
        </a>
        <div class="finding-detail">${escapeHtml(official.reason || '')}</div>
      </div>
    ` : impersonation.status === 'critical' ? `
      <div class="official-box official-box-danger" role="alert">
        <div class="official-badge official-badge-danger">⚠ POSSIBLE CLONE / IMPERSONATION</div>
        <h3>${escapeHtml(impersonation.details || 'Possible impersonation detected')}</h3>
        <p>This domain is not in the verified official directory, but it shows signals associated with a verified organisation.</p>
        ${Array.isArray(impersonation.reasons) && impersonation.reasons.length ? `<ul class="scanner-reasons">${impersonation.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
        ${impersonation.recommendation ? `<p><strong>Recommendation:</strong> ${escapeHtml(impersonation.recommendation)}</p>` : ''}
      </div>
    ` : `
      <div class="official-box">
        <strong>Official website status</strong>
        <p>This domain is not currently in the verified official-website directory. That means <strong>unverified</strong>, not automatically scam.</p>
        <div class="finding-detail">A website can only receive the verified-official label when its domain is present in our trusted directory or a trusted verification source is added.</div>
      </div>
    `;

    const checksHtml = Object.entries(checks)
      .map(([key, check]) => renderCheck(key, check))
      .join('');

    result.innerHTML = `
      <div class="overall overall-${escapeHtml(resultInfo.status || 'info')} ${isVerified ? 'overall-verified' : ''}">
        <div class="overall-title">
          ${icon(resultInfo.status)} ${escapeHtml(resultInfo.title || 'Scan complete')}
        </div>
        <div>${escapeHtml(resultInfo.explanation || '')}</div>
        <div class="scan-meta">
          Checked URL: ${escapeHtml(data.finalUrl || data.scannedUrl || '')}<br>
          HTTP status: ${escapeHtml(data.statusCode || '')}
        </div>
      </div>

      ${officialHtml}

      <div class="findings">
        ${checksHtml}
      </div>

      <div class="scanner-warning">
        <strong>Safety conclusion:</strong>
        ${escapeHtml(data.disclaimer || 'Technical checks provide evidence, not a guarantee of safety.')}
      </div>
    `;

    result.hidden = false;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const url = input.value.trim();

    if (!url) {
      showStatus('Enter a website address first.', 'warning');
      return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SCANNING...';
    result.hidden = true;
    result.innerHTML = '';
    showStatus('Checking DNS, HTTPS/TLS, redirects, security headers and official website status...', 'info');

    try {
      const response = await fetch('/api/link-scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'The website could not be checked.');
      }

      hideStatus();
      renderResults(data);
    } catch (error) {
      showStatus(error.message || 'The website could not be checked from the server.', 'critical');
      result.hidden = true;
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-magnifying-glass"></i> SCAN WEBSITE';
    }
  });
})();
