const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const USERS_TABLE = 'recovery_users';
const EVENTS_TABLE = 'recovery_security_events';

const USER_SELECT = `
  id,
  username,
  email,
  phone,
  role,
  admin_status,
  security_status,
  security_reason,
  security_updated_at,
  security_updated_by,
  created_at,
  last_login_at,
  failed_login_attempts,
  login_locked_until,
  mfa_enabled,
  session_version
`;

const EVENT_TYPES = new Set([
  'login_success',
  'login_failed',
  'logout',
  'mfa_success',
  'mfa_failed',
  'password_reset_request',
  'password_reset_success',
  'account_created',
  'account_updated',
  'case_created',
  'case_viewed',
  'case_updated',
  'message_sent',
  'message_viewed',
  'file_uploaded',
  'file_downloaded',
  'website_scan_requested',
  'call_started',
  'call_ended',
  'auth_failed',
  'csrf_rejected',
  'rate_limited',
  'account_restricted',
  'account_suspended',
  'account_blocked',
  'account_unblocked',
  'account_reactivated',
  'sessions_revoked',
  'suspicious_login',
  'admin_action',
  'owner_action',
]);

const SEVERITIES = new Set([
  'info',
  'low',
  'medium',
  'high',
  'critical',
]);

function normalizeEventType(eventType) {
  const value = String(eventType || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();

  return value || 'security_event';
}

function normalizeSeverity(severity) {
  const value = String(severity || 'info').trim().toLowerCase();
  return SEVERITIES.has(value) ? value : 'info';
}

function hashSecurityValue(value) {
  if (!value) return null;

  const secret =
    process.env.SECURITY_LOG_HASH_SECRET ||
    process.env.JWT_SECRET ||
    'manlung-security-log';

  return crypto
    .createHmac('sha256', secret)
    .update(String(value))
    .digest('hex');
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const blockedKeys = new Set([
    'password',
    'passwd',
    'token',
    'access_token',
    'refresh_token',
    'jwt',
    'authorization',
    'secret',
    'mfa_secret',
    'otp',
    'otp_code',
    'reset_token',
    'private_key',
    'service_key',
  ]);

  const result = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (blockedKeys.has(String(key).toLowerCase())) continue;

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] =
        typeof value === 'string' ? value.slice(0, 1000) : value;
    } else if (Array.isArray(value)) {
      result[key] = value.slice(0, 50);
    } else if (typeof value === 'object') {
      result[key] = sanitizeMetadata(value);
    }
  }

  return result;
}

async function listUsers({ search, status, role, limit = 100 } = {}) {
  let query = supabase
    .from(USERS_TABLE)
    .select(USER_SELECT)
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limit) || 100, 500));

  if (search) {
    const like = `%${String(search).trim()}%`;

    query = query.or(
      `username.ilike.${like},email.ilike.${like},phone.ilike.${like}`
    );
  }

  if (
    status &&
    ['active', 'restricted', 'suspended', 'blocked'].includes(status)
  ) {
    query = query.eq('security_status', status);
  }

  if (role && ['client', 'admin', 'owner'].includes(role)) {
    query = query.eq('role', role);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

async function getUser(userId) {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select(USER_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function setSecurityStatus(userId, status, reason, actorId) {
  const allowed = ['active', 'restricted', 'suspended', 'blocked'];

  if (!allowed.includes(status)) {
    throw new Error('Invalid security status');
  }

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .update({
      security_status: status,
      security_reason: reason || null,
      security_updated_at: new Date().toISOString(),
      security_updated_by: actorId,
    })
    .eq('id', userId)
    .select(USER_SELECT)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function revokeSessions(userId) {
  const { data: current, error: findError } = await supabase
    .from(USERS_TABLE)
    .select('id, session_version')
    .eq('id', userId)
    .maybeSingle();

  if (findError) throw findError;
  if (!current) return null;

  const nextVersion = Number(current.session_version || 0) + 1;

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .update({ session_version: nextVersion })
    .eq('id', userId)
    .select('id, session_version')
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function recordEvent({
  eventType,
  severity = 'info',
  userId = null,
  actorUserId = null,
  ipAddress = null,
  userAgent = null,
  loginIdentifier = null,
  path = null,
  httpStatus = null,
  details = {},
  metadata = null,
} = {}) {
  const normalizedType = normalizeEventType(eventType);

  const eventMetadata = sanitizeMetadata({
    ...(details && typeof details === 'object' ? details : {}),
    ...(metadata && typeof metadata === 'object' ? metadata : {}),
  });

  if (actorUserId) {
    eventMetadata.actor_user_id = actorUserId;
  }

  const row = {
    event_type: normalizedType,
    severity: normalizeSeverity(severity),
    user_id: userId,
    login_identifier: loginIdentifier
      ? String(loginIdentifier).slice(0, 320)
      : null,
    ip_hash: hashSecurityValue(ipAddress),
    user_agent_hash: hashSecurityValue(userAgent),
    path: path ? String(path).slice(0, 500) : null,
    http_status:
      Number.isInteger(Number(httpStatus)) ? Number(httpStatus) : null,
    metadata: eventMetadata,
  };

  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .insert(row)
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function listEvents({
  userId,
  eventType,
  severity,
  limit = 200,
} = {}) {
  let query = supabase
    .from(EVENTS_TABLE)
    .select(
      'id,event_type,severity,user_id,login_identifier,ip_hash,user_agent_hash,path,http_status,metadata,created_at'
    )
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limit) || 200, 500));

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (eventType) {
    query = query.eq('event_type', normalizeEventType(eventType));
  }

  if (severity && SEVERITIES.has(String(severity).toLowerCase())) {
    query = query.eq('severity', String(severity).toLowerCase());
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

async function getOverview() {
  const [users, events] = await Promise.all([listUsers({ limit: 500 }), listEvents({ limit: 100 })]);
  const counts = { active: 0, restricted: 0, suspended: 0, blocked: 0 };
  users.forEach(u => { const s = u.security_status || 'active'; counts[s] = (counts[s] || 0) + 1; });
  const since = Date.now() - 86400000;
  return {
    users_total: users.length,
    counts,
    failed_logins_24h: events.filter(e => e.event_type === 'login_failed' && new Date(e.created_at).getTime() >= since).length,
    suspicious_24h: events.filter(e => e.event_type === 'suspicious_login' && new Date(e.created_at).getTime() >= since).length,
    high_priority_events: events.filter(e => ['high','critical'].includes(e.severity)).slice(0, 25),
    recent_events: events.slice(0, 25),
  };
}

async function getUserDetail(userId) {
  const user = await getUser(userId);
  if (!user) return null;
  const [events, sessionsResult] = await Promise.all([
    listEvents({ userId, limit: 100 }),
    supabase.from('auth.sessions').select('id,created_at,updated_at,user_id').eq('user_id', userId).order('updated_at', { ascending: false }).limit(50),
  ]);
  if (sessionsResult.error) throw sessionsResult.error;
  return { user, events, sessions: sessionsResult.data || [] };
}


async function getAnalytics() {
  const [events, users] = await Promise.all([
    listEvents({ limit: 500 }),
    listUsers({ limit: 500 }),
  ]);
  const since = Date.now() - 7 * 86400000;
  const daily = {};
  const typeCounts = {};
  for (const e of events) {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    if (d.getTime() >= since) daily[key] = (daily[key] || 0) + 1;
    typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1;
  }
  const loginEvents = events.filter(e => ['login_success','login_failed','suspicious_login'].includes(e.event_type));
  const failed = loginEvents.filter(e => e.event_type === 'login_failed').length;
  const successful = loginEvents.filter(e => e.event_type === 'login_success').length;
  return {
    users: { total: users.length, clients: users.filter(u=>u.role==='client').length, admins: users.filter(u=>u.role==='admin').length, restricted: users.filter(u=>u.security_status && u.security_status!=='active').length },
    login: { successful, failed, suspicious: loginEvents.filter(e=>e.event_type==='suspicious_login').length, failure_rate: successful + failed ? Math.round((failed/(successful+failed))*1000)/10 : 0 },
    daily: Object.entries(daily).sort(([a],[b])=>a.localeCompare(b)).map(([date,count])=>({date,count})),
    event_types: Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([event_type,count])=>({event_type,count})),
  };
}

async function getCaseOperations() {
  const { data, error } = await supabase
    .from('recovery_cases')
    .select('id,case_id,client_name,case_type,priority,status,assigned_admin_id,assigned_at,started_at,completed_at,sla_due_at,last_status_changed_at,created_at,last_updated,client_user_id')
    .order('created_at', { ascending: false })
    .limit(250);
  if (error) throw error;
  const cases = data || [];
  const now = Date.now();
  return {
    totals: {
      total: cases.length,
      pending: cases.filter(c=>/pending/i.test(c.status||'')).length,
      active: cases.filter(c=>/progress|active|investigat/i.test(c.status||'')).length,
      completed: cases.filter(c=>/completed|closed/i.test(c.status||'')).length,
      overdue: cases.filter(c=>c.sla_due_at && new Date(c.sla_due_at).getTime() < now && !/completed|closed/i.test(c.status||'')).length,
    },
    cases,
  };
}

async function getAuditCenter(limit = 250) {
  const { data, error } = await supabase
    .from('recovery_admin_audit_log')
    .select('id,actor_user_id,actor_username,target_user_id,target_username,action,details,created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limit)||250,500));
  if (error) throw error;
  return data || [];
}

async function getCaseIntelligence(caseId) {
  const [timeline, docs] = await Promise.all([
    supabase.from('case_timeline').select('id,case_id,actor_user_id,event_type,description,metadata,created_at').eq('case_id', caseId).order('created_at',{ascending:false}).limit(250),
    supabase.from('admin_documents').select('id,case_id,title,owner_user_id,created_at,updated_at,deleted_at').eq('case_id', caseId).order('created_at',{ascending:false}).limit(100),
  ]);
  if (timeline.error) throw timeline.error;
  if (docs.error) throw docs.error;
  const { data: row, error: caseError } = await supabase.from('recovery_cases').select('case_id,client_name,case_type,priority,status,files,created_at,last_updated').eq('case_id',caseId).maybeSingle();
  if (caseError) throw caseError;
  const evidence = Array.isArray(row?.files) ? row.files.map((f,i)=>({ index:i, filename:f?.filename||f?.originalName||'Evidence file', path:f?.path||null, mimetype:f?.mimetype||null, size:f?.size||null, uploadedAt:f?.uploadedAt||null, uploadedBy:f?.uploadedBy||null, requestId:f?.requestId||null })) : [];
  return { case: row, timeline: timeline.data||[], documents: docs.data||[], evidence };
}

module.exports = {
  listUsers,
  getUser,
  setSecurityStatus,
  revokeSessions,
  recordEvent,
  listEvents,
  getAnalytics,
  getCaseOperations,
  getAuditCenter,
  getCaseIntelligence,
};
