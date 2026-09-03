const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const PUBLIC_ROOT = path.join(__dirname, '..', 'public');
const ROOT = path.join(__dirname, '..');
const MODEL = process.env.MANLUNG_AI_MODEL || 'gpt-5.6-luna';
const MAX_HISTORY = 16;

const SITE_RULES = `
You are Manlung Recovery AI, the official customer-support assistant for the Manlung Recovery website.

Your job:
- Explain the actual Manlung Recovery website, its features, workflows and public information accurately.
- Speak naturally like a helpful human support assistant. Do not sound like a keyword bot.
- Use the supplied current-site context as the primary source for Manlung-specific facts.
- If the user asks about current events, current prices, current laws, current threats, current technology, a public website, or other outside-world information, use web search when available. Clearly distinguish web-sourced information from Manlung's own policies.
- If information is unavailable, say so rather than inventing it.
- Never claim to be a human admin or investigator.
- Never claim that a recovery will succeed or that a human is available unless the current system explicitly confirms it.
- Never ask for or repeat passwords, PINs, OTPs, recovery codes, API keys, payment-card secrets or other authentication secrets.
- Guide users toward legitimate recovery, investigation and defensive cybersecurity activity. Do not facilitate unauthorized access, credential theft, phishing, malware deployment or abuse.
- For immediate physical danger or an incident happening now, advise appropriate local emergency services/law enforcement first.
- For human support, direct users to the site's Call Admin, WhatsApp, phone or email options.
- When discussing a site feature, explain where the user can find it and what it does when the site context supports that.
- When the user is vague, ask one useful clarifying question instead of dumping a generic list.
- Keep answers concise unless the user asks for detail.

Current Manlung Recovery public product facts include: New Recovery Request intake; client authentication and portal; Track a Case; case notifications/timeline/messages; device recovery; social/email account recovery; identity-theft assistance; online scam investigation; website security incidents; malware/virus investigation; network security assessment; human support; and real WebRTC Call Admin. Call Admin is currently documented as free, rings available admins, and the first admin to accept gets the call. Live human availability must not be guessed.
`;

function safePublicPath(requestPath) {
  let p = String(requestPath || '/index.html').split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  if (p === '/') p = '/index.html';
  const candidate = path.resolve(PUBLIC_ROOT, `.${p}`);
  if (!candidate.startsWith(`${PUBLIC_ROOT}${path.sep}`) && candidate !== PUBLIC_ROOT) return null;
  return candidate;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLinks(html) {
  const out = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) && out.length < 80) {
    const href = m[1];
    const label = stripHtml(m[2]).slice(0, 100);
    if (href && label) out.push(`${label} -> ${href}`);
  }
  return out;
}

function readIfExists(file, limit = 24000) {
  try {
    return fs.readFileSync(file, 'utf8').slice(0, limit);
  } catch (_) {
    return '';
  }
}

function buildSiteContext(pagePath) {
  const file = safePublicPath(pagePath);
  let page = '';
  let title = '';
  let links = [];

  if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
    page = readIfExists(file, 45000);
    const tm = page.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    title = tm ? stripHtml(tm[1]) : '';
    links = extractLinks(page);
  }

  const publicFiles = fs.existsSync(PUBLIC_ROOT)
    ? fs.readdirSync(PUBLIC_ROOT).filter(name => /\.(html|js)$/i.test(name)).slice(0, 160)
    : [];

  const docs = [
    ['README.md', 30000],
    ['WEBSITE_SCANNER_UPGRADE.md', 16000],
    ['FINAL_CLEAN_SECURITY_SEO_PWA_REPORT_2026-08-29.md', 12000],
    ['IMPLEMENTATION_REPORT.md', 16000]
  ].map(([name, max]) => {
    const content = readIfExists(path.join(ROOT, name), max);
    return content ? `\n--- ${name} ---\n${content}` : '';
  }).join('');

  return `CURRENT PAGE PATH: ${pagePath || '/'}\nCURRENT PAGE TITLE: ${title}\n\nCURRENT PAGE TEXT:\n${stripHtml(page).slice(0, 35000)}\n\nCURRENT PAGE LINKS:\n${links.join('\n').slice(0, 9000)}\n\nPUBLIC FRONTEND FILES:\n${publicFiles.join(', ')}\n${docs}`.slice(0, 105000);
}

function extractOutput(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

router.post('/chat', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Manlung AI backend is not configured yet. Add OPENAI_API_KEY to the server environment.'
      });
    }

    const message = String(req.body?.message || '').trim().slice(0, 8000);
    if (!message) return res.status(400).json({ success: false, error: 'Message is required.' });

    const history = Array.isArray(req.body?.history)
      ? req.body.history
          .filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
          .slice(-MAX_HISTORY)
          .map(x => ({ role: x.role, content: x.content.slice(0, 6000) }))
      : [];

    const pagePath = String(req.body?.pagePath || '/').slice(0, 300);
    const context = buildSiteContext(pagePath);

    const response = await axios.post(
      'https://api.openai.com/v1/responses',
      {
        model: MODEL,
        tools: [{ type: 'web_search' }],
        input: [
          { role: 'system', content: [{ type: 'input_text', text: SITE_RULES }] },
          { role: 'system', content: [{ type: 'input_text', text: `Live site context follows. Treat it as the source of truth for Manlung-specific UI/features.\n\n${context}` }] },
          ...history,
          { role: 'user', content: [{ type: 'input_text', text: message }] }
        ],
        max_output_tokens: 1200
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const answer = extractOutput(response.data);
    if (!answer) throw new Error('The AI returned an empty response.');

    return res.json({ success: true, answer, model: MODEL, webSearchEnabled: true });
  } catch (error) {
    const status = error.response?.status;
    console.error('Manlung AI error:', status || '', error.response?.data || error.message);
    return res.status(502).json({
      success: false,
      error: 'The live AI service is temporarily unavailable. Please try again or use Human Support.'
    });
  }
});

router.get('/site-context', (req, res) => {
  const pagePath = String(req.query?.path || '/').slice(0, 300);
  res.json({ success: true, pagePath, context: buildSiteContext(pagePath) });
});

module.exports = router;
