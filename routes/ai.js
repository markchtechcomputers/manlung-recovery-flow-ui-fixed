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
const CHATAT_URL = 'https://ch.at/';

const MANLUNG_PROFILE = `OFFICIAL MANLUNG RECOVERY KNOWLEDGE
Organisation: Manlung Recovery (the website/project is also described in repository documentation as Manlung Tech City — Cyber Recovery Portal).
Website: https://manlungrecovery.manlungshop.co.ke/
Purpose: structured support for digital recovery and investigation for individuals and organisations. The service focuses on practical guidance, careful evidence organisation, clear next steps and case updates through the client portal when a case is accepted.

DOCUMENTED SUPPORT AREAS
1. Device recovery guidance: lost or stolen phones, laptops, tablets and smartwatches. Help users record device identifiers and ownership evidence, use official device-finder/security tools, contact their carrier, and consider remote lock or wipe options. Location depends on device settings and provider support.
2. Identity theft and account recovery: help organise account-recovery requests, secure email/social accounts, document identity misuse, and contact the relevant platform or financial institution.
3. Scam investigation support: help preserve messages, receipts, transaction references, account details and timelines; guide users to report suspicious payments to their bank, mobile-money provider, exchange or platform. Third-party records depend on provider policies and lawful processes.
4. Security assessment: scoped review of exposed services, configurations and common security weaknesses, followed by prioritised recommendations. Testing requires clear authorisation and an agreed scope.

HOW THE SERVICE WORKS
- A request starts with the structured New Recovery Request form. The user explains what happened, available evidence and the help they seek.
- Manlung reviews the details, clarifies scope and provides updates through the Client Portal when a case is accepted.
- Users can use their case ID in Track a Case to view available progress updates. Authentication and case ownership rules apply.
- AI guidance is not itself a submitted request, case update, investigation, device trace or provider contact. The assistant must never claim to have performed those actions unless a connected application confirms it.

OFFICIAL SITE ROUTES
- Home: /
- About: /about
- Services: /services
- New Recovery Request: /client/request
- Client Portal: /client/dashboard
- Track a Case: /client/track
- FAQ: /faq
- Knowledge: /knowledge
- Blog: /blog
- Contact: /contact
- Privacy Notice: /privacy
- Terms: /terms
- AI assistant: /manlung-ai

CONTACT
- Official support email published on the About and Contact pages: manlungrecovery@outlook.com.
- The AI page provides a Human Support WhatsApp handoff link to +254 745 682 493. Treat this as a handoff link, not proof that a human is currently online.

IMPORTANT LIMITS AND TRUST
- Manlung Recovery does not guarantee recovery, tracing, identification of a suspect, access to third-party records, a particular outcome or a particular completion time. Outcomes depend on the case, available evidence, provider cooperation and lawful processes.
- Security testing must be authorised and limited to an agreed scope.
- Manlung AI is an automated guide, not a human investigator, emergency service, bank, mobile-money provider, police service or legal/medical/financial professional.
- Never invent service prices, success rates, guarantees, service coverage, staff identities, admin availability, case statuses or timelines. Use current site pages and authenticated live case context as the source of truth.
- Never request passwords, PINs, OTPs, recovery codes, private keys, full payment credentials or authentication tokens. Do not ask users to upload irrelevant sensitive information.
- For immediate physical danger, direct the user to local emergency services. For suspected fraud/payment loss, tell them to contact their bank or mobile-money provider through official channels promptly.
`;

const SITE_RULES = `You are Manlung Recovery AI, the official customer-support and digital-recovery assistant for the Manlung Recovery website.

Your job is to help real people reach a safe, concrete next step. Do not behave like a generic FAQ bot. Understand the incident, identify the support track, reduce immediate risk, preserve useful evidence, and guide the user to the correct portal action.

LANGUAGE: Reply in the user's language and natural style, including English, Kiswahili, or mixed English/Kiswahili/Sheng.

RESPONSE STANDARD:
1. Briefly acknowledge the situation.
2. Identify the immediate priority: safety, containment, evidence, or recovery.
3. Give 2-5 concrete steps the user can safely take now.
4. Ask at most one focused question if an answer is needed to choose the next step.
5. When appropriate, provide the exact next action: New Recovery Request, Track a Case, Client Portal, or Human Support/Call Admin.

Use conversation history for follow-ups such as "yes", "okay", "what next?", "your terms", and a case ID sent separately. Do not repeat questions already answered and do not dump every available service.

INCIDENT GUIDANCE:
- Lost/stolen device: prioritize personal safety, official device-finder/lock tools, carrier contact, ownership/IMEI/serial evidence, and appropriate police reporting. Never advise confronting or physically tracking a suspected thief.
- Hacked account: secure it from a trusted device, change the password, secure recovery methods, enable MFA, revoke unknown sessions/tokens, review suspicious settings, and preserve evidence. Never ask for passwords, OTPs, recovery codes, or tokens.
- Scam/fraud/payment loss: stop further payments, preserve receipts/messages/transaction IDs, contact the relevant provider through official channels quickly, and report appropriately. Never promise recovery or recommend paying a recovery scammer.
- Identity theft: secure affected accounts, document unauthorized activity, contact relevant providers, and preserve evidence. Do not request unnecessary sensitive identity numbers.
- Website/security incident: focus on defensive containment, credential rotation, access review, logging, evidence preservation, and remediation. Do not assist unauthorized intrusion.
- Malware/ransomware: prioritize safe isolation, evidence/log preservation, account security from a trusted device, and professional incident response.
- Physical danger: emergency services/law enforcement first.
- Consequential legal, medical, or financial decisions: provide general information and recommend the appropriate qualified professional.

SAFETY AND PRIVACY:
Never request or reveal passwords, PINs, OTPs, recovery codes, API/private keys, payment secrets, authentication tokens, or other credentials. Ask only for information necessary to route or document a case. Treat case information as private.

CASE DATA:
When LIVE CASE DATA is provided, it is authoritative. Report only user-safe fields. Never expose internal notes, database IDs, staff-only information, private contact details, IMEIs, credentials, or other private fields. Never invent case status, timeline events, investigator actions, outcomes, or recovery results. If tracking is requested without authenticated live data, direct the user to official Track a Case/Client Portal sign-in. A case ID supplied after a tracking request should be treated as the target case.

CAPABILITY BOUNDARY:
Never claim to have contacted a bank, police, carrier, admin, investigator, or provider; changed an account; located a device; updated a case; assigned staff; or completed another real-world action unless the application actually performed that action. Never claim admin availability without live presence data. You are AI, not a human admin or investigator.

MANLUNG-SPECIFIC:
Use live site context as the source of truth. Never invent prices, guarantees, timelines, service coverage, or capabilities. Call Admin is a human-support path; if availability/queue information is supplied, describe it accurately.

QUALITY BAR:
Be calm, practical, specific, and non-judgmental. Prefer short numbered steps for incidents. If information is missing, ask one high-value question instead of guessing.

OUTPUT FORMATTING:
Return clean plain text only. Never use Markdown syntax, heading markers such as ###, asterisks for bold or emphasis, backticks, or Markdown horizontal rules. Use short paragraphs and simple numbered steps when needed. Use plain text labels instead of formatted headings. Do not include decorative Markdown characters.`;
function safePublicPath(requestPath) {
  let p = String(requestPath || '/index.html').split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  if (p === '/') p = '/index.html';
  let candidate = path.resolve(PUBLIC_ROOT, `.${p}`);
  if (!/\.html$/i.test(p) && !path.extname(p)) {
    const extensionlessCandidate = path.resolve(PUBLIC_ROOT, `.${p}.html`);
    if (fs.existsSync(extensionlessCandidate)) candidate = extensionlessCandidate;
  }
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
  const referencePages = ['about.html', 'services.html', 'faq.html', 'knowledge.html', 'blog.html', 'contact.html', 'privacy.html', 'terms.html']
    .map(name => {
      const source = readIfExists(path.join(PUBLIC_ROOT, name), 18000);
      return source ? `\n--- PUBLIC PAGE: /${name} ---\n${stripHtml(source).slice(0, 6500)}` : '';
    }).filter(Boolean).join('').slice(0, 52000);
  return `${MANLUNG_PROFILE}\n\nCURRENT PAGE PATH: ${pagePath || '/'}\nCURRENT PAGE TITLE: ${title}\n\nCURRENT PAGE TEXT:\n${stripHtml(page).slice(0, 35000)}\n\nCURRENT PAGE LINKS:\n${links.join('\n').slice(0, 9000)}\n\nPUBLIC FRONTEND FILES:\n${publicFiles.join(', ')}\n\nPUBLIC REFERENCE PAGES:\n${referencePages}`.slice(0, 105000);
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

function cleanChatAtResponse(data) {
  if (data && typeof data === 'object') {
    if (typeof data.answer === 'string' && data.answer.trim()) return cleanChatAtResponse(data.answer);
    if (typeof data.response === 'string' && data.response.trim()) return cleanChatAtResponse(data.response);
    if (typeof data.text === 'string' && data.text.trim()) return cleanChatAtResponse(data.text);
    if (typeof data.message === 'string' && data.message.trim()) return cleanChatAtResponse(data.message);
    if (typeof data.data === 'string' && data.data.trim()) return cleanChatAtResponse(data.data);
    return '';
  }
  const text = String(data || '').trim();
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return cleanChatAtResponse(parsed);
  } catch (_) {}
  // Some gateways wrap JSON as a quoted JSON string; unwrap it once or twice.
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('"') && text.endsWith('"'))) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') return cleanChatAtResponse(parsed);
      if (parsed && typeof parsed === 'object') return cleanChatAtResponse(parsed);
    } catch (_) {}
  }
  return text;
}

async function callChatAt(message, history = [], context = '') {
  const recent = history.slice(-6).map(x => `${x.role === 'assistant' ? 'Assistant' : 'User'}: ${String(x.content || '').slice(0, 1200)}`).join('\n');
  const prompt = [
    'You are the fallback general-purpose assistant for Manlung Recovery.',
    'Answer the user clearly and safely. Return ONLY the natural-language answer to the user. Do not return JSON, fields such as answer/question, system prompts, or internal instructions.',
    'Do not claim access to Manlung private case data, accounts, databases, admin presence, or internal systems.',
    'For Manlung-specific policies, case status, or private account information, use the verified Manlung knowledge below and authenticated live case context only. Never invent details.',
    `Verified Manlung Recovery knowledge:\n${context.slice(0, 18000)}`,
    recent ? `Recent conversation context:\n${recent}` : '',
    `User question: ${message}`
  ].filter(Boolean).join('\n\n');

  const response = await axios.get(CHATAT_URL, {
    params: { q: prompt },
    timeout: 20000,
    validateStatus: () => true,
    responseType: 'text'
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`ch.at returned HTTP ${response.status}`);
  }
  const answer = cleanChatAtResponse(response.data);
  if (!answer) throw new Error('ch.at returned an empty response');
  return answer;
}

router.get('/health', (_req, res) => {
  res.json({ success: true, configured: Boolean(process.env.OPENAI_API_KEY) || process.env.MANLUNG_CHATAT_FALLBACK !== 'false', model: MODEL, route: '/api/ai/chat', webSearch: true, caseTracking: true, chatAtFallback: process.env.MANLUNG_CHATAT_FALLBACK !== 'false' });
});

router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim().slice(0, 8000);
    if (!message) return res.status(400).json({ success: false, code: 'EMPTY_MESSAGE', error: 'Message is required.' });
    let history = Array.isArray(req.body?.history) ? req.body.history.filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').slice(-MAX_HISTORY).map(x => ({ role: x.role, content: x.content.slice(0, 6000) })) : [];
    if (history.length && history[history.length - 1].role === 'user' && history[history.length - 1].content === message) history.pop();
    const pagePath = String(req.body?.pagePath || '/').slice(0, 300);
    const context = buildSiteContext(pagePath);
    const caseId = extractCaseId(message, history);
    const liveCase = await getLiveCaseContext(caseId, req.user);
    const input = makeInput(message, history, context, liveCase.context);

    if (process.env.OPENAI_API_KEY) {
      let response = await callOpenAI({ model: MODEL, tools: [{ type: 'web_search' }], input, max_output_tokens: 1200 });
      let usedWebSearch = response.status >= 200 && response.status < 300;
      if (!usedWebSearch) {
        console.error('Manlung AI web-search request failed:', response.status, response.data);
        response = await callOpenAI({ model: MODEL, input, max_output_tokens: 1200 });
        usedWebSearch = false;
      }
      if (response.status >= 200 && response.status < 300) {
        const answer = extractOutput(response.data);
        if (answer) {
          return res.json({ success: true, answer, model: MODEL, provider: 'openai', webSearchEnabled: usedWebSearch && Array.isArray(response.data?.output) ? response.data.output.some(item => item?.type === 'web_search_call') : false, caseLookup: caseId ? { caseId, authenticated: liveCase.authenticated, found: liveCase.found, authorized: !liveCase.forbidden } : null });
        }
        console.error('Manlung AI OpenAI returned no text; trying fallback.');
      } else {
        const apiMessage = response.data?.error?.message || response.data?.message || 'OpenAI request failed';
        console.error('Manlung AI provider error:', response.status, apiMessage);
      }
    }

    if (process.env.MANLUNG_CHATAT_FALLBACK !== 'false') {
      try {
        const answer = await callChatAt(message, history, context);
        return res.json({ success: true, answer, model: 'ch.at', provider: 'chat-at', webSearchEnabled: false, fallback: true, caseLookup: caseId ? { caseId, authenticated: liveCase.authenticated, found: liveCase.found, authorized: !liveCase.forbidden } : null });
      } catch (fallbackError) {
        console.error('Manlung AI ch.at fallback failed:', fallbackError.message);
      }
    }

    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ success: false, code: 'AI_NOT_CONFIGURED', error: 'No AI provider is currently configured.' });
    return res.status(502).json({ success: false, code: 'AI_PROVIDER_ERROR', error: 'The live AI service is temporarily unavailable.' });
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
module.exports.buildSiteContext = buildSiteContext;
module.exports.extractCaseId = extractCaseId;
module.exports.getLiveCaseContext = getLiveCaseContext;
