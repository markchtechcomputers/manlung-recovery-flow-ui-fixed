const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const PUBLIC_ROOT = path.join(__dirname, '..', 'public');
const ROOT = path.join(__dirname, '..');
const MODEL = process.env.MANLUNG_AI_MODEL || 'gpt-5.6-luna';
const MAX_HISTORY = 16;
const OPENAI_URL = 'https://api.openai.com/v1/responses';

const SITE_RULES = `
You are Manlung Recovery AI, the official customer-support assistant for the Manlung Recovery website.

Your job:
- Explain the actual Manlung Recovery website, its features, workflows and public information accurately.
- Speak naturally like a helpful human support assistant, not like a keyword bot.
- Use the supplied current-site context as the primary source for Manlung-specific facts.
- For current events, current laws, current threats, current technology, public websites, or other changing outside-world information, use web search when available.
- If web search is unavailable, answer from your existing knowledge and clearly say when information may be current-sensitive.
- Never invent a Manlung feature, policy, price, case status, human availability, or result.
- Never claim to be a human admin or investigator.
- Never claim recovery is guaranteed.
- Never ask for or repeat passwords, PINs, OTPs, recovery codes, API keys, payment-card secrets, or other authentication secrets.
- Help only with legitimate recovery, investigation and defensive cybersecurity activity. Do not facilitate unauthorized access, credential theft, phishing, malware deployment or abuse.
- For immediate physical danger or an incident happening now, advise appropriate local emergency services/law enforcement first.
- For human support, direct users to the site's Call Admin, WhatsApp, phone or email options.
- When discussing a site feature, explain where the user can find it and what it does when the site context supports that.
- If a user provides a case ID, do not pretend you can see its private status unless a real case lookup tool is connected. Explain that Track a Case is used for actual case information.
- When the user asks to contact an admin, explain the available Call Admin/WhatsApp/phone/email options and do not claim a live admin is available unless the site provides live presence.
- When the user is vague, ask one useful clarifying question instead of dumping a generic list.
- Keep answers concise unless the user asks for detail.

Manlung Recovery is a Cyber Recovery & Digital Investigation Portal. Public features include New Recovery Request, client authentication/portal, Track a Case, case notifications/timeline/messages, device recovery, social/email account recovery, identity-theft assistance, online scam investigation, website security incidents, malware/virus investigation, network security assessment, human support, and WebRTC Call Admin.
Call Admin is documented as free, rings available admins, and the first admin to accept gets the call. Never guess whether an admin is online; use live availability only when the website explicitly provides it.
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

function makeInput(message, history, context) {
  return [
    { role: 'system', content: [{ type: 'input_text', text: SITE_RULES }] },
    { role: 'system', content: [{ type: 'input_text', text: `Live site context follows. Treat it as the source of truth for Manlung-specific UI/features.\n\n${context}` }] },
    ...history,
    { role: 'user', content: [{ type: 'input_text', text: message }] }
  ];
}

async function callOpenAI(payload) {
  return axios.post(OPENAI_URL, payload, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 45000,
    validateStatus: () => true
  });
}

// Safe diagnostic endpoint. It never returns the API key or any secret.
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: MODEL,
    route: '/api/ai/chat',
    webSearch: true
  });
});

router.post('/chat', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        code: 'AI_NOT_CONFIGURED',
        error: 'Manlung AI backend is not configured yet. Add OPENAI_API_KEY to the server environment.'
      });
    }

    const message = String(req.body?.message || '').trim().slice(0, 8000);
    if (!message) return res.status(400).json({ success: false, code: 'EMPTY_MESSAGE', error: 'Message is required.' });

    let history = Array.isArray(req.body?.history)
      ? req.body.history
          .filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
          .slice(-MAX_HISTORY)
          .map(x => ({ role: x.role, content: x.content.slice(0, 6000) }))
      : [];

    if (history.length && history[history.length - 1].role === 'user' && history[history.length - 1].content === message) {
      history.pop();
    }

    const pagePath = String(req.body?.pagePath || '/').slice(0, 300);
    const context = buildSiteContext(pagePath);
    const input = makeInput(message, history, context);

    let response = await callOpenAI({
      model: MODEL,
      tools: [{ type: 'web_search_preview' }],
      input,
      max_output_tokens: 1200
    });

    if (response.status < 200 || response.status >= 300) {
      console.error('Manlung AI web-search request failed:', response.status, response.data);
      response = await callOpenAI({
        model: MODEL,
        input,
        max_output_tokens: 1200
      });
    }

    if (response.status < 200 || response.status >= 300) {
      const apiMessage = response.data?.error?.message || response.data?.message || 'OpenAI request failed';
      console.error('Manlung AI fallback request failed:', response.status, apiMessage);
      return res.status(502).json({
        success: false,
        code: 'AI_PROVIDER_ERROR',
        error: 'The AI provider rejected the request. Please try again shortly or use Human Support.'
      });
    }

    const answer = extractOutput(response.data);
    if (!answer) {
      console.error('Manlung AI returned no text:', JSON.stringify(response.data).slice(0, 4000));
      return res.status(502).json({
        success: false,
        code: 'AI_EMPTY_RESPONSE',
        error: 'The AI returned an empty response. Please try again.'
      });
    }

    return res.json({
      success: true,
      answer,
      model: MODEL,
      webSearchEnabled: Array.isArray(response.data?.output)
        ? response.data.output.some(item => item?.type === 'web_search_call')
        : false
    });
  } catch (error) {
    console.error('Manlung AI unexpected error:', error.response?.data || error.stack || error.message);
    return res.status(502).json({
      success: false,
      code: 'AI_UNEXPECTED_ERROR',
      error: 'The live AI service is temporarily unavailable. Please try again or use Human Support.'
    });
  }
});

router.get('/site-context', (req, res) => {
  const pagePath = String(req.query?.path || '/').slice(0, 300);
  res.json({ success: true, pagePath, context: buildSiteContext(pagePath) });
});

module.exports = router;
