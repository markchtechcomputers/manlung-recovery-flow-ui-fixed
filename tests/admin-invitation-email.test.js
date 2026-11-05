const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminInvitationEmail } = require('../services/adminInvitationEmail');
test('admin invitation email uses Manlung branding and secure onboarding instructions', () => {
 const result=buildAdminInvitationEmail({email:'admin@example.com',link:'https://example.com/admin/register?token=abc'});
 assert.match(result.html,/Manlung Recovery/); assert.match(result.html,/icon-512\.png/);
 assert.match(result.html,/Accept invitation/); assert.match(result.html,/48 hours/);
 assert.match(result.html,/pending until the Owner approves/); assert.match(result.text,/48 hours/);
});
test('admin invitation email escapes untrusted values', () => {
 const result=buildAdminInvitationEmail({email:'<script>alert(1)</script>',link:'https://example.com/?x="bad"&y=1'});
 assert.doesNotMatch(result.html,/<script>alert/); assert.match(result.html,/&lt;script&gt;/); assert.match(result.html,/&amp;y=1/);
});