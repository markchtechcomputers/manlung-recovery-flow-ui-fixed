const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminInvitationEmail } = require('../services/adminInvitationEmail');

test('admin invitation email is branded and includes the Manlung icon and secure CTA', () => {
  const link = 'https://manlungrecovery.manlungshop.co.ke/admin/register.html?token=abc123&email=admin%40example.com';
  const { html, text } = buildAdminInvitationEmail({ email: 'admin@example.com', link });

  assert.match(html, /MANLUNG RECOVERY/);
  assert.match(html, /\/icons\/icon-512\.png/);
  assert.match(html, /Accept invitation/);
  assert.match(html, /48 hours/);
  assert.match(html, /pending until the Owner approves/);
  assert.match(html, /href="https:\/\/manlungrecovery\.manlungshop\.co\.ke\/admin\/register\.html\?token=abc123&amp;email=admin%40example\.com"/);
  assert.match(text, /admin@example\.com/);
  assert.match(text, new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('admin invitation email escapes untrusted email text in HTML', () => {
  const { html } = buildAdminInvitationEmail({
    email: '<admin@example.com>',
    link: 'https://manlungrecovery.manlungshop.co.ke/admin/register.html?token=safe'
  });

  assert.match(html, /&lt;admin@example\.com&gt;/);
  assert.doesNotMatch(html, /<strong style="color:#173b60;">\s*<admin/);
});
