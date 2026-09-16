-- Add Owner Security & Monitoring actions to the existing admin audit vocabulary.

alter table public.recovery_admin_audit_log
  drop constraint if exists recovery_admin_audit_log_action_check;

alter table public.recovery_admin_audit_log
  add constraint recovery_admin_audit_log_action_check
  check (
    action in (
      'invited_admin',
      'assigned_admin',
      'approved_admin',
      'updated_admin_permissions',
      'suspended_admin',
      'reactivated_admin',
      'removed_admin',
      'cleared_call_logs',
      'deleted_client_message',
      'security_status_changed',
      'revoked_user_sessions'
    )
  );
