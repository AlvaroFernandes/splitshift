-- 025_worker_team_access.sql
-- "Accountant access": a worker who logs their own hours but can also read
-- the whole team's reports and invoices, like a viewer. Set by an admin on
-- the Team tab (through /api/team, with the service role).

alter table profiles add column if not exists team_access boolean not null default false;

-- profiles_own_update lets a user write their whole profile row, so RLS alone
-- can't stop a worker from granting themselves access. Only service-role
-- calls (auth.uid() is null — i.e. /api/team) may change team_access.
create or replace function protect_profiles_team_access()
returns trigger language plpgsql security definer as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.team_access := false;
  else
    new.team_access := old.team_access;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_team_access on profiles;

create trigger profiles_protect_team_access
  before insert or update on profiles
  for each row execute function protect_profiles_team_access();

-- Workers with team access get every viewer read policy (entries, profiles,
-- invoices, bank closures and adjustments of their team), all of which are
-- already scoped by manages_user().
create or replace function is_viewer()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid()
      and removed_at is null
      and (role = 'viewer' or (role = 'user' and team_access))
  );
$$;

-- Viewers need each worker's rules (TFN limit, mode, rate) to process the
-- team's hours the same way admins do.
drop policy if exists "settings_viewer_select" on settings;
create policy "settings_viewer_select" on settings
  for select using (is_viewer() and manages_user(user_id));
