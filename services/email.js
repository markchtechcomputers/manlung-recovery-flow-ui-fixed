const axios = require('axios');

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.warn('Email provider not configured; email not sent to', to);
    return { sent: false, configured: false };
  }
  await axios.post('https://api.resend.com/emails', { from: process.env.EMAIL_FROM, to: [to], subject, html }, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 10000,
  });
  return { sent: true, configured: true };
}

module.exports = { sendEmail };
