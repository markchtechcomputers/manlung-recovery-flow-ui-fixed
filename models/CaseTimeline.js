const { supabase } = require('../config/supabase');

const TABLE = 'case_timeline';

async function create({
  caseId,
  actorUserId = null,
  eventType,
  description,
  metadata = null,
}) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      case_id: caseId,
      actor_user_id: actorUserId,
      event_type: eventType,
      description,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function listForCase(caseId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

module.exports = {
  create,
  listForCase,
};
