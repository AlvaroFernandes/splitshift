-- 022_profiles_removed.sql
-- An admin can remove someone from their team. Removal is a soft flag: the
-- person loses access (their auth user is also banned by /api/team), but
-- their profile, entries, invoices and bank history stay in place so the
-- admin's reports keep the full history. Restoring clears the flag.

alter table profiles add column if not exists removed_at timestamptz;

-- profiles_own_update lets a user write their whole profile row, so RLS alone
-- can't stop a removed user from clearing their own flag. Only service-role
-- calls (auth.uid() is null — i.e. /api/team) may change removed_at.
create or replace function protect_profiles_removed_at()
returns trigger language plpgsql security definer as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.removed_at := null;
  else
    new.removed_at := old.removed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_removed_at on profiles;

create trigger profiles_protect_removed_at
  before insert or update on profiles
  for each row execute function protect_profiles_removed_at();
