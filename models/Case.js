const { supabase } = require('../config/supabase');

const TABLE = 'recovery_cases';

const FINISHED_STATUSES = [
  'Recovery Successful',
  'Recovered by Police',
  'Recovered by Owner',
  'Closed',
  'Rejected',
];

async function create(fields) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(fields)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function findByCaseId(caseId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findByClientUserId(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('client_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function findByEmail(email) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

async function update(caseId, fields) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(fields)
    .eq('case_id', caseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function remove(caseId) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('case_id', caseId);

  if (error) throw error;
}

async function search({
  search,
  category,
  status,
  progress,
  unread,
  investigator,
  page = 1,
  limit = 20,
}) {
  let query = supabase.from(TABLE).select('*', { count: 'exact' });

  if (search) {
    const like = `%${search}%`;

    query = query.or(
      [
        `case_id.ilike.${like}`,
        `client_name.ilike.${like}`,
        `phone.ilike.${like}`,
        `email.ilike.${like}`,
        `imei1.ilike.${like}`,
        `imei2.ilike.${like}`,
      ].join(',')
    );
  }

  if (category && category !== 'all') {
    query = query.eq('case_type', category);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (progress === 'finished') {
    query = query.in('status', FINISHED_STATUSES);
  }

  if (progress === 'unfinished') {
    query = query.not(
      'status',
      'in',
      `(${FINISHED_STATUSES.map((s) => `"${s}"`).join(',')})`
    );
  }

  if (unread === 'true') {
    query = query.eq('admin_read', false);
  }

  if (investigator) {
    query = query.eq('investigator', investigator);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    cases: data,
    total: count,
  };
}

async function searchAll({
  search,
  category,
  status,
  progress,
  unread,
  investigator,
}) {
  let query = supabase.from(TABLE).select('*');

  if (search) {
    const like = `%${search}%`;

    query = query.or(
      [
        `case_id.ilike.${like}`,
        `client_name.ilike.${like}`,
        `phone.ilike.${like}`,
        `email.ilike.${like}`,
        `imei1.ilike.${like}`,
        `imei2.ilike.${like}`,
      ].join(',')
    );
  }

  if (category && category !== 'all') {
    query = query.eq('case_type', category);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (progress === 'finished') {
    query = query.in('status', FINISHED_STATUSES);
  }

  if (progress === 'unfinished') {
    query = query.not(
      'status',
      'in',
      `(${FINISHED_STATUSES.map((s) => `"${s}"`).join(',')})`
    );
  }

  if (unread === 'true') {
    query = query.eq('admin_read', false);
  }

  if (investigator) {
    query = query.eq('investigator', investigator);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;

  return data;
}

async function bulkUpdate(caseIds, fields) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(fields)
    .in('case_id', caseIds)
    .select();

  if (error) throw error;
  return data;
}

async function claim(caseId, adminId) {
  const { data, error } = await supabase.rpc(
    'claim_recovery_case',
    {
      p_case_id: caseId,
      p_admin_id: adminId,
    }
  );

  if (error) throw error;
  return data;
}

async function complete(caseId, adminId, status) {
  const { data, error } = await supabase.rpc(
    'complete_recovery_case',
    {
      p_case_id: caseId,
      p_admin_id: adminId,
      p_status: status,
    }
  );

  if (error) throw error;
  return data;
}

async function countActiveByAdmin(adminId) {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('assigned_admin_id', adminId)
    .not('status', 'in', '("Recovery Successful","Recovered by Police","Recovered by Owner","Closed","Rejected")');
  if (error) throw error;
  return count || 0;
}

async function findActiveByAdmin(adminId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('assigned_admin_id', adminId)
    .not(
      'status',
      'in',
      '("Recovery Successful","Recovered by Police","Recovered by Owner","Closed","Rejected")'
    )
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function countWhere(filters) {
  let query = supabase
    .from(TABLE)
    .select('*', {
      count: 'exact',
      head: true,
    });

  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { count, error } = await query;

  if (error) throw error;
  return count;
}

async function countWhereIn(column, values) {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', {
      count: 'exact',
      head: true,
    })
    .in(column, values);

  if (error) throw error;
  return count;
}

async function stats() {
  const [
    total,
    pending,
    progress,
    closed,
    rejected,
    unread,
  ] = await Promise.all([
    countWhere({}),
    countWhere({ status: 'Pending Review' }),
    countWhereIn('status', [
      'Accepted',
      'Under Investigation',
      'Evidence Collected',
      'Awaiting Customer Response',
    ]),
    countWhereIn(
      'status',
      FINISHED_STATUSES.filter((s) => s !== 'Rejected')
    ),
    countWhere({ status: 'Rejected' }),
    countWhere({ admin_read: false }),
  ]);

  return {
    total,
    pending,
    progress,
    closed,
    rejected,
    unread,
  };
}

module.exports = {
  create,
  findByCaseId,
  findByClientUserId,
  findByEmail,
  update,
  remove,
  search,
  searchAll,
  bulkUpdate,
  stats,
  claim,
  complete,
  findActiveByAdmin,
  countActiveByAdmin,
  FINISHED_STATUSES,
};
