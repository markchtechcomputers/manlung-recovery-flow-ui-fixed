const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const Case = require('../models/Case');
const CaseTimeline = require('../models/CaseTimeline');
const { optionalAuth } = require('../middleware/auth');
const PUBLIC_ROOT = path.join(__dirname, '..', 'public');
const ROOT = path.join(__dirname, '..');
const MODEL = process.env.MANLUNG_AI_MODEL || 'gpt-5.6-luna';
const MAX_HISTORY = 16;
const OPENAI_URL = 'https://api.openai.com/v1/responses';

const SITE_RULES = `You are Manlung Recovery AI, the official customer-support assistant for the Manlung Recovery website.
Speak naturally and conversationally. Never behave like a keyword bot or reset the conversation unnecessarily.
Use the live site context and Manlung AI knowledge guide as the source of truth for Manlung-specific features, policies and workflows.
Use recent conversation history to understand follow-up messages such as "your terms", "how?", "okay", "yes", and a case ID sent in a separate message.
When LIVE CASE DATA is provided, use it as the authoritative current case status. Never invent or alter case facts.
Use web search for current outside-world information when available.
Never invent features, prices, case status, admin availability, guarantees, or results.
Never claim to be a human admin or investigator.
Never request passwords, PINs, OTPs, recovery codes, API keys, payment secrets, or other authentication secrets.
Only help with legitimate recovery, investigation, and defensive cybersecurity.
For immediate physical danger, advise appropriate emergency services/law enforcement first.
If the user asks to track/check a case and live case data is present, answer with the actual case status and useful next steps. If no live case data is present because the user is not authenticated, explain that sign-in is required to protect private case information and direct them to Track a Case or Client Portal.
If the user provides only a case ID immediately after a tracking request, treat that as the requested case and perform the lookup.
If the user asks about "your terms", "your privacy", "your services", or "how your site works", answer about Manlung Recovery itself using the site context/knowledge guide instead of asking what happened.
If the user is vague, ask one useful clarifying question. Keep normal answers concise but useful.

Manlung Recovery is a Cyber Recovery & Digital Investigation Portal. Public features include New Recovery Request, Client Portal, Track a Case, case notifications/timeline/messages, device recovery, social/email account recovery, identity-theft assistance, online scam investigation, website security incidents, malware/virus investigation, network security assessment, Human Support, and WebRTC Call Admin.
Call Admin is documented as free, rings available admins, and the first admin to accept gets the call. Do not claim an admin is online unless live presence is actually available.`;

function safePublicPath(requestPath) {
  let p = String(requestPath || '/index.html').split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  if (p === '/') p = '/index.html';
  const candidate = path.resolve(PUBLIC_ROOT, `.${p}`);
  if (!candidate.startsWith(`${PUBLIC_ROOT}${path.sep}`) && candidate !== PUBLIC_ROOT) return null;
  return candidate;
}

function stripHtml(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
}

function extractLinks(html) {
  const out = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) && out.length < 80) {
    const label = stripHtml(m[2]).slice(0, 100);
    if (m[1] && label) out.push(`${label} -> ${m[1]}`);
  }
  return out;
}

function readIfExists(file, limit = 24000) {
  try { return fs.readFileSync(file, 'utf8').slice(0, limit); } catch (_) { return ''; }
}

function buildSiteContext(pagePath) {
  const file = safePublicPath(pagePath);
  let page = '', title = '', links = [];
  if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
    page = readIfExists(file, 45000);
    const tm = page.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    title = tm ? stripHtml(tm[1]) : '';
    links = extractLinks(page);
  }
  const publicFiles = fs.existsSync(PUBLIC_ROOT) ? fs.readdirSync(PUBLIC_ROOT).filter(name => /\.(html|js)$/i.test(name)).slice(0, 160) : [];
  const docs = [
    ['README.md', 30000],
    ['WEBSITE_SCANNER_UPGRADE.md', 16000],
    ['FINAL_CLEAN_SECURITY_SEO_PWA_REPORT_2026-08-29.md', 12000],
    ['IMPLEMENTATION_REPORT.md', 16000]
  ].map(([name, max]) => { const content = readIfExists(path.join(ROOT, name), max); return content ? `\n--- ${name} ---\n${content}` : ''; }).join('');
  return `CURRENT PAGE PATH: ${pagePath || '/'}\nCURRENT PAGE TITLE: ${title}\n\nCURRENT PAGE TEXT:\n${stripHtml(page).slice(0, 35000)}\n\nCURRENT PAGE LINKS:\n${links.join('\n').slice(0, 9000)}\n\nPUBLIC FRONTEND FILES:\n${publicFiles.join(', ')}\n${docs}`.slice(0, 105000);
}

function extractOutput(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
      else if (typeof content?.text?.value === 'string') parts.push(content.text.value);
    }
  }
  return parts.join('\n').trim();
}

function makeInput(message, history, context, caseContext) {
  return [
    { role: 'system', content: SITE_RULES },
    { role: 'system', content: `LIVE SITE CONTEXT — use this as the source of truth for Manlung-specific UI and features:\n\n${context}` },
    { role: 'system', content: `LIVE CASE DATA — this is private, authenticated runtime data. Use it only to answer the current user's case question. Never expose internal notes, database IDs, emails, phone numbers, IMEIs, credentials, or other private fields.\n\n${caseContext || 'No case was looked up for this message.'}` },
    ...history,
    { role: 'user', content: message }
  ];
}

function extractCaseId(message, history = []) {
  const candidates = [String(message || ''), ...history.slice().reverse().map(x => String(x?.content || ''))];
  for (const text of candidates) {
    const match = text.match(/\bMTC[-\s]?\d{4}[-\s]?\d{3}\b/i);
    if (!match) continue;
    return match[0].toUpperCase().replace(/\s+/g, '-').replace(/^MTC(?!-)/, 'MTC-').replace(/MTC-(\d{4})\s*[-]?\s*(\d{3})/, 'MTC-$1-$2');
  }
  return null;
}

async function getLiveCaseContext(caseId, user) {
  if (!caseId) return { context: '', found: false, authenticated: Boolean(user) };
  if (!user) return { authenticated: false, found: false, context: 'CASE LOOKUP REQUESTED, BUT THE USER IS NOT AUTHENTICATED. Do not reveal any case data. Tell the user to sign in to Track a Case or Client Portal.' };
  const row = await Case.findByCaseId(caseId);
  if (!row) return { authenticated: true, found: false, context: `CASE ${caseId} was not found in the live case database. Do not invent a status.` };
  const isPrivileged = user.role === 'admin' || user.role === 'owner';
  const ownsCase = String(row.client_user_id || '') === String(user.id || '');
  if (!isPrivileged && !ownsCase) return { authenticated: true, found: false, forbidden: true, context: `CASE ${caseId} exists, but this authenticated user is not authorized to view it. Do not reveal whether the case exists, its status, owner, timeline, investigator, or any other data. Tell the user they can only track cases belonging to their account.` };
  const timeline = await CaseTimeline.listForCase(caseId);
  const publicTimeline = timeline.slice(-12).map(item => ({ date: item.created_at, event: item.event_type, update: item.description }));
  const safe = { caseId: row.case_id, status: row.status, caseType: row.case_type, priority: row.priority, investigator: row.investigator || null, publicNotes: row.public_notes || null, recoveryLocation: row.recovery_loc || null, lastUpdated: row.last_updated || null, createdAt: row.created_at || null, timeline: publicTimeline };
  return { authenticated: true, found: true, context: JSON.stringify(safe, null, 2) };
}

async function callOpenAI(payload) {
  return axios.post(OPENAI_URL, payload, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 45000, validateStatus: () => true });
}

router.get('/health', (_req, res) => {
  res.json({ success: true, configured: Boolean(process.env.OPENAI_API_KEY), model: MODEL, route: '/api/ai/chat', webSearch: true, caseTracking: true });
});

router.post('/chat', optionalAuth, async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ success: false, code: 'AI_NOT_CONFIGURED', error: 'OPENAI_API_KEY is not configured on the server.' });
    const message = String(req.body?.message || '').trim().slice(0, 8000);
    if (!message) return res.status(400).json({ success: false, code: 'EMPTY_MESSAGE', error: 'Message is required.' });
    let history = Array.isArray(req.body?.history) ? req.body.history.filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').slice(-MAX_HISTORY).map(x => ({ role: x.role, content: x.content.slice(0, 6000) })) : [];
    if (history.length && history[history.length - 1].role === 'user' && history[history.length - 1].content === message) history.pop();
    const pagePath = String(req.body?.pagePath || '/').slice(0, 300);
    const context = buildSiteContext(pagePath);
    const caseId = extractCaseId(message, history);
    const liveCase = await getLiveCaseContext(caseId, req.user);
    const input = makeInput(message, history, context, liveCase.context);
    let response = await callOpenAI({ model: MODEL, tools: [{ type: 'web_search' }], input, max_output_tokens: 1200 });
    let usedWebSearch = response.status >= 200 && response.status < 300;
    if (!usedWebSearch) {
      console.error('Manlung AI web-search request failed:', response.status, response.data);
      response = await callOpenAI({ model: MODEL, input, max_output_tokens: 1200 });
      usedWebSearch = false;
    }
    if (response.status < 200 || response.status >= 300) {
      const apiMessage = response.data?.error?.message || response.data?.message || 'OpenAI request failed';
      console.error('Manlung AI provider error:', response.status, apiMessage);
      return res.status(502).json({ success: false, code: 'AI_PROVIDER_ERROR', error: apiMessage.slice(0, 500) });
    }
    const answer = extractOutput(response.data);
    if (!answer) return res.status(502).json({ success: false, code: 'AI_EMPTY_RESPONSE', error: 'The AI returned no text.' });
    return res.json({ success: true, answer, model: MODEL, webSearchEnabled: usedWebSearch && Array.isArray(response.data?.output) ? response.data.output.some(item => item?.type === 'web_search_call') : false, caseLookup: caseId ? { caseId, authenticated: liveCase.authenticated, found: liveCase.found, authorized: !liveCase.forbidden } : null });
  } catch (error) {
    console.error('Manlung AI unexpected error:', error.response?.data || error.stack || error.message);
    return res.status(502).json({ success: false, code: 'AI_UNEXPECTED_ERROR', error: 'The live AI service is temporarily unavailable.' });
  }
});

router.get('/site-context', (req, res) => {
  const pagePath = String(req.query?.path || '/').slice(0, 300);
  res.json({ success: true, pagePath, context: buildSiteContext(pagePath) });
});

module.exports = router;
