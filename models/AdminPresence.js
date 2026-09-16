const { supabase } = require('../config/supabase');

const TABLE = 'recovery_admin_presence';
const CALL_TABLE = 'recovery_call_sessions';

// If the admin dashboard hasn't pinged in this long, treat them as offline.
const STALE_MS = 45 * 1000;

async function setOnline(adminUserId) {
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        admin_user_id: adminUserId,
        is_online: true,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'admin_user_id' }
    );
  if (error) throw error;
}

async function setOffline(adminUserId) {
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        admin_user_id: adminUserId,
        is_online: false,
        is_busy: false,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'admin_user_id' }
    );
  if (error) throw error;
}

async function setBusy(adminUserId, isBusy) {
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        admin_user_id: adminUserId,
        is_busy: isBusy,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'admin_user_id' }
    );
  if (error) throw error;
}

// Available means:
//   - presence is online,
//   - heartbeat is fresh,
//   - presence is not marked busy,
//   - and there is no actually active accepted call.
// The final check is important because a stale "busy" flag from a crashed
// browser must not permanently make every client see "Admin unavailable".
async function getAvailabilityState() {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();

  const [
    { data: presenceRows, error: presenceError },
    { data: activeCalls, error: callError },
  ] = await Promise.all([
    supabase
      .from(TABLE)
      .select('admin_user_id, is_online, is_busy, last_seen')
      .eq('is_online', true)
      .gt('last_seen', cutoff),
    supabase
      .from(CALL_TABLE)
      .select('admin_user_id')
      .eq('status', 'accepted')
      .is('ended_at', null)
      .not('admin_user_id', 'is', null),
  ]);

  if (presenceError) throw presenceError;
  if (callError) throw callError;

  const activeAdminIds = new Set(
    (activeCalls || []).map((row) => row.admin_user_id).filter(Boolean)
  );

  const onlineCount = (presenceRows || []).length;
  const availableCount = (presenceRows || []).filter((row) => {
    if (row.is_busy) return false;
    return !activeAdminIds.has(row.admin_user_id);
  }).length;

  const staleBusyRows = (presenceRows || []).filter(
    (row) => row.is_busy && !activeAdminIds.has(row.admin_user_id)
  );

  if (staleBusyRows.length) {
    await Promise.all(
      staleBusyRows.map((row) =>
        supabase
          .from(TABLE)
          .update({ is_busy: false })
          .eq('admin_user_id', row.admin_user_id)
          .eq('is_online', true)
      )
    );
  }

  const effectiveAvailableCount = availableCount + staleBusyRows.length;
  let state = 'offline';
  if (onlineCount > 0 && effectiveAvailableCount === 0) state = 'busy';
  if (effectiveAvailableCount > 0) state = 'available';

  return { state, onlineCount, availableCount: effectiveAvailableCount };
}

async function anyAdminAvailable() {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();

  const [
    { data: presenceRows, error: presenceError },
    { data: activeCalls, error: callError },
  ] = await Promise.all([
    supabase
      .from(TABLE)
      .select('admin_user_id, is_online, is_busy, last_seen')
      .eq('is_online', true)
      .gt('last_seen', cutoff),
    supabase
      .from(CALL_TABLE)
      .select('admin_user_id')
      .eq('status', 'accepted')
      .is('ended_at', null)
      .not('admin_user_id', 'is', null),
  ]);

  if (presenceError) throw presenceError;
  if (callError) throw callError;

  const activeAdminIds = new Set(
    (activeCalls || []).map((row) => row.admin_user_id).filter(Boolean)
  );

  const available = (presenceRows || []).find((row) => {
    if (row.is_busy) return false;
    if (activeAdminIds.has(row.admin_user_id)) return false;
    return true;
  });

  // Repair a stale busy flag when we can prove there is no active call.
  // This makes the next availability check and the Admin UI recover naturally
  // after a crashed/reloaded browser.
  const staleBusyRows = (presenceRows || []).filter(
    (row) => row.is_busy && !activeAdminIds.has(row.admin_user_id)
  );

  if (staleBusyRows.length) {
    await Promise.all(
      staleBusyRows.map((row) =>
        supabase
          .from(TABLE)
          .update({ is_busy: false })
          .eq('admin_user_id', row.admin_user_id)
          .eq('is_online', true)
      )
    );
  }

  return !!available || staleBusyRows.length > 0;
}

module.exports = {
  setOnline,
  setOffline,
  setBusy,
  anyAdminAvailable,
  getAvailabilityState,
  STALE_MS,
};
