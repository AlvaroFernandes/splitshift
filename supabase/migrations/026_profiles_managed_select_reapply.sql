-- 026_profiles_managed_select_reapply.sql
-- Migration 007 is recorded as applied, but production still had the original
-- 001 policy (admin_id = auth.uid()), so co-admins couldn't see any worker
-- profiles and their Team tab was empty. Re-apply the manages_user() version,
-- which covers both the owner and co-admins.

drop policy if exists "profiles_managed_select" on profiles;

create policy "profiles_managed_select" on profiles
  for select using (is_admin() and manages_user(user_id));
