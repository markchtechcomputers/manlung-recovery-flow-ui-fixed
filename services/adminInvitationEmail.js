const BRAND_NAME = 'Manlung Recovery';
const BRAND_URL = 'https://manlungrecovery.manlungshop.co.ke';
const BRAND_ICON = `${BRAND_URL}/icons/icon-512.png`;

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function buildAdminInvitationEmail({ email, link }) {
  const safeEmail = escapeHtml(email);
  const safeLink = escapeHtml(link);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>You're invited to Manlung Recovery</title>
</head>
<body style="margin:0;padding:0;background:#edf3f9;font-family:Arial,Helvetica,sans-serif;color:#172b45;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#edf3f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #dce6f1;border-radius:18px;overflow:hidden;">
        <tr>
          <td align="center" style="padding:30px 24px 26px;background:#0b2340;background-image:linear-gradient(135deg,#0b2340 0%,#123d68 58%,#176b83 100%);">
            <img src="${BRAND_ICON}" width="68" height="68" alt="Manlung Recovery icon" style="display:block;width:68px;height:68px;object-fit:contain;border:3px solid rgba(255,255,255,.82);border-radius:18px;background:#ffffff;padding:4px;">
            <div style="margin-top:13px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:1.5px;">MANLUNG RECOVERY</div>
            <div style="margin-top:5px;color:#c8e4f4;font-size:11px;font-weight:700;letter-spacing:2px;">CYBER RECOVERY &amp; DIGITAL INVESTIGATION</div>
          </td>
        </tr>
        <tr>
          <td style="padding:34px 34px 12px;">
            <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#e8f3ff;color:#1d5d93;font-size:11px;font-weight:800;letter-spacing:1px;">ADMIN TEAM INVITATION</div>
            <h1 style="margin:17px 0 12px;color:#102b49;font-size:27px;line-height:1.2;font-weight:800;">You're invited to join our team</h1>
            <p style="margin:0 0 14px;color:#53677e;font-size:15px;line-height:1.75;">The Owner has invited <strong style="color:#173b60;">${safeEmail}</strong> to create an Admin account on Manlung Recovery.</p>
            <p style="margin:0;color:#53677e;font-size:14px;line-height:1.75;">Use the secure button below to set up your own username and password. Your Admin access will remain pending until the Owner approves your account.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:25px 34px 17px;">
            <a href="${safeLink}" style="display:inline-block;min-width:220px;padding:15px 24px;border-radius:10px;background:#1769aa;background-image:linear-gradient(100deg,#145b96,#1684a0);color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:800;letter-spacing:.2px;">Accept invitation&nbsp; &rarr;</a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 34px 25px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f7fb;border:1px solid #dce8f3;border-radius:12px;">
              <tr><td style="padding:16px 17px;">
                <div style="color:#183c5e;font-size:12px;font-weight:800;">WHAT HAPPENS NEXT</div>
                <p style="margin:8px 0 0;color:#53677e;font-size:13px;line-height:1.7;">1. Open the invitation link.<br>2. Create your Admin username and password.<br>3. Wait for the Owner to approve your account.</p>
              </td></tr>
            </table>
            <p style="margin:19px 0 7px;color:#60748a;font-size:12px;line-height:1.65;">This secure invitation expires in <strong style="color:#173b60;">48 hours</strong> and can only be used once.</p>
            <p style="margin:0;color:#60748a;font-size:12px;line-height:1.65;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="margin:7px 0 0;overflow-wrap:anywhere;word-break:break-word;font-size:11px;line-height:1.6;"><a href="${safeLink}" style="color:#1769aa;text-decoration:underline;">${safeLink}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;background:#f7f9fc;border-top:1px solid #e5edf5;text-align:center;">
            <div style="color:#254663;font-size:12px;font-weight:800;">Manlung Recovery</div>
            <div style="margin-top:5px;color:#8191a3;font-size:11px;line-height:1.6;">Secure account onboarding · If you weren't expecting this invitation, you can safely ignore this email.</div>
            <a href="${BRAND_URL}" style="display:inline-block;margin-top:9px;color:#1769aa;font-size:11px;font-weight:700;text-decoration:none;">Visit Manlung Recovery</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [
    'MANLUNG RECOVERY — ADMIN TEAM INVITATION',
    '',
    'The Owner has invited ' + String(email) + ' to create an Admin account on Manlung Recovery.',
    'Use this secure link to create your username and password:',
    String(link),
    '',
    'After registration, your account remains pending until the Owner approves it.',
    'This invitation expires in 48 hours and can only be used once.',
    '',
    'If you were not expecting this invitation, you can ignore this email.',
    BRAND_URL
  ].join('\n');

  return { html, text };
}

module.exports = { buildAdminInvitationEmail };
