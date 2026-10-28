-- 023_shared_admin_access.sql
-- Every admin on a team gets the same access as the account owner (the root
-- admin). A co-admin's profile has admin_id = <root>; the root's is null.

-- The root admin id for the calling admin (their own id if they are the root).
create or replace function my_root_admin()
returns uuid language sql security definer stable set search_path = public as $$
  select coalesce(admin_id, user_id) from profiles
  where user_id = auth.uid() and role = 'admin';
$$;

-- Co-admins can see the owner's profile (the owner has no admin_id, so
-- manages_user() never matches it).
drop policy if exists "profiles_root_admin_select" on profiles;
create policy "profiles_root_admin_select" on profiles
  for select using (is_admin() and user_id = my_root_admin());

-- ── Shared activity log ────────────────────────────────────────────────────────
-- Entries are now filed under the team's root admin, so every admin sees the
-- whole team's activity. Move co-admins' past entries over too.
update audit_log a
   set admin_id = p.admin_id
  from profiles p
 where p.user_id = a.admin_id
   and p.role = 'admin'
   and p.admin_id is not null;

drop policy if exists "admins_read_audit" on audit_log;
create policy "admins_read_audit" on audit_log
  for select using (admin_id = my_root_admin());

drop policy if exists "admins_insert_audit" on audit_log;
create policy "admins_insert_audit" on audit_log
  for insert with check (actor_id = auth.uid() and is_admin() and admin_id = my_root_admin());
