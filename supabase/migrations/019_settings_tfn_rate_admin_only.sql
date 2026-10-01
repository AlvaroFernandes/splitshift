-- 019_settings_tfn_rate_admin_only.sql
-- A worker's TFN hourly rate is set by their admin (Settings → Work Rules).
-- The rate lives inside settings.data alongside fields the worker edits
-- themselves, and settings_own_update lets a worker write that whole JSON
-- blob — so RLS alone can't stop a worker from changing their own rate.
-- This trigger keeps tfnRate pinned to its previous value whenever a
-- non-admin writes their own settings row.

create or replace function protect_settings_tfn_rate()
returns trigger language plpgsql security definer as $$
begin
  -- Admins (and service-role calls, where auth.uid() is null) may set any value.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{tfnRate}', '""'::jsonb);
  else
    new.data := jsonb_set(
      coalesce(new.data, '{}'::jsonb), '{tfnRate}',
      coalesce(old.data -> 'tfnRate', '""'::jsonb)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists settings_protect_tfn_rate on settings;

create trigger settings_protect_tfn_rate
  before insert or update on settings
  for each row execute function protect_settings_tfn_rate();
