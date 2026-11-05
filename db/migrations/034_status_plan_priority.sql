-- Keep status-plan enforcement aligned with the subscription status endpoint.
-- Pro always wins while both Pro and Plus purchases are still active.
create or replace function public.recovery_chat_consume_status_allowance()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  w public.recovery_chat_status_wallets%rowtype;
  active_plan text;
  recent_count integer;
  max_posts integer;
begin
  insert into public.recovery_chat_status_wallets(user_id)
    values(new.user_id)
    on conflict(user_id) do nothing;

  select * into w
    from public.recovery_chat_status_wallets
    where user_id=new.user_id
    for update;

  select p.plan_code into active_plan
    from public.recovery_chat_plan_purchases p
    where p.user_id=new.user_id
      and p.status='paid'
      and p.expires_at>now()
      and p.plan_code in ('plus','pro')
    order by case p.plan_code when 'pro' then 2 when 'plus' then 1 else 0 end desc,
             p.expires_at desc
    limit 1;

  max_posts := case active_plan when 'plus' then 3 when 'pro' then 100 else 1 end;

  select count(*)::integer into recent_count
    from public.recovery_chat_status_posts
    where user_id=new.user_id
      and created_at>now()-interval '24 hours';

  if recent_count < max_posts then
    if active_plan is null
       and w.free_status_last_used_at is not null
       and w.free_status_last_used_at>now()-interval '24 hours'
       and w.paid_status_credits>0 then
      update public.recovery_chat_status_wallets
        set paid_status_credits=paid_status_credits-1,updated_at=now()
        where user_id=new.user_id;
    elsif active_plan is null
       and w.free_status_last_used_at is not null
       and w.free_status_last_used_at>now()-interval '24 hours'
       and w.paid_status_credits<=0 then
      raise exception 'STATUS_ALLOWANCE_EXHAUSTED' using errcode='P0001';
    elsif active_plan is null then
      update public.recovery_chat_status_wallets
        set free_status_last_used_at=now(),updated_at=now()
        where user_id=new.user_id;
    end if;
  else
    if active_plan is null and w.paid_status_credits>0 then
      update public.recovery_chat_status_wallets
        set paid_status_credits=paid_status_credits-1,updated_at=now()
        where user_id=new.user_id;
    else
      raise exception 'STATUS_ALLOWANCE_EXHAUSTED' using errcode='P0001';
    end if;
  end if;

  new.expires_at:=now()+interval '24 hours';
  return new;
end;
$$;

revoke all on function public.recovery_chat_consume_status_allowance() from public,anon,authenticated;
notify pgrst,'reload schema';
