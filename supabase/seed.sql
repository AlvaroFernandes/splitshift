-- ── Test users seed ───────────────────────────────────────────────────────────
-- This script sets up profiles, settings, and sample entries for test users
-- that were already created via the Supabase dashboard or create-test-users.js.
--
-- Run AFTER create-test-users.js (or after creating the users manually in the
-- Supabase dashboard under Authentication > Users).
--
-- Test accounts (created by create-test-users.js):
--   admin@hoursplit.test    / Test1234!   → role: admin
--   worker1@hoursplit.test  / Test1234!   → role: user (managed by admin)
--   worker2@hoursplit.test  / Test1234!   → role: user (managed by admin)

do $$
declare
  admin_id   uuid;
  worker1_id uuid;
  worker2_id uuid;
begin

  -- Resolve UUIDs from emails (users must already exist in auth.users)
  select id into admin_id   from auth.users where email = 'admin@hoursplit.test'   limit 1;
  select id into worker1_id from auth.users where email = 'worker1@hoursplit.test' limit 1;
  select id into worker2_id from auth.users where email = 'worker2@hoursplit.test' limit 1;

  if admin_id is null then
    raise exception 'admin@hoursplit.test not found — run create-test-users.js first';
  end if;
  if worker1_id is null then
    raise exception 'worker1@hoursplit.test not found — run create-test-users.js first';
  end if;
  if worker2_id is null then
    raise exception 'worker2@hoursplit.test not found — run create-test-users.js first';
  end if;

  -- ── Profiles ─────────────────────────────────────────────────────────────────

  insert into profiles (user_id, role, admin_id, email, name) values
    (admin_id,   'admin', null,     'admin@hoursplit.test',   'Test Admin'),
    (worker1_id, 'user',  admin_id, 'worker1@hoursplit.test', 'Alice Worker'),
    (worker2_id, 'user',  admin_id, 'worker2@hoursplit.test', 'Bob Worker')
  on conflict (user_id) do update
    set role     = excluded.role,
        admin_id = excluded.admin_id,
        email    = excluded.email,
        name     = excluded.name;

  -- ── Settings ─────────────────────────────────────────────────────────────────

  insert into settings (user_id, data, period_start, period_end) values
    (
      admin_id,
      '{"yourName":"Test Admin","abn":"12 345 678 901","companyName":"HourSplit Demo","tfnLimit":30,"overtimeThreshold":8,"defaultRate":35,"invoiceNum":1}'::jsonb,
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month - 1 day')::date
    ),
    (
      worker1_id,
      '{"yourName":"Alice Worker","tfn":"123 456 789","tfnLimit":30,"overtimeThreshold":8,"defaultRate":40,"invoiceNum":1}'::jsonb,
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month - 1 day')::date
    ),
    (
      worker2_id,
      '{"yourName":"Bob Worker","tfn":"987 654 321","tfnLimit":30,"overtimeThreshold":8,"defaultRate":38,"invoiceNum":1}'::jsonb,
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month - 1 day')::date
    )
  on conflict (user_id) do nothing;

  -- ── Sample entries (last 6 days) ──────────────────────────────────────────────

  insert into entries (id, user_id, date, job_description, start_time, end_time, hourly_rate, break_mins, archived) values
    (gen_random_uuid(), worker1_id, current_date - 6, 'Warehouse pick-pack',   '07:00', '15:30', 40, 30, false),
    (gen_random_uuid(), worker1_id, current_date - 5, 'Warehouse pick-pack',   '07:00', '15:30', 40, 30, false),
    (gen_random_uuid(), worker1_id, current_date - 4, 'Forklift operations',   '06:00', '14:00', 40, 30, false),
    (gen_random_uuid(), worker1_id, current_date - 3, 'Stock-take overtime',   '07:00', '17:00', 40, 30, false),
    (gen_random_uuid(), worker1_id, current_date - 2, 'Loading dock',          '07:00', '15:00', 40, 30, false),
    (gen_random_uuid(), worker1_id, current_date - 1, 'Dispatch coordination', '08:00', '16:00', 40, 30, false),
    (gen_random_uuid(), worker2_id, current_date - 6, 'Site safety inspection','08:00', '16:30', 38, 30, false),
    (gen_random_uuid(), worker2_id, current_date - 5, 'Site safety inspection','08:00', '16:30', 38, 30, false),
    (gen_random_uuid(), worker2_id, current_date - 3, 'Hazmat handling',       '06:00', '14:30', 38, 30, false),
    (gen_random_uuid(), worker2_id, current_date - 2, 'Equipment maintenance', '07:00', '15:00', 38, 30, false),
    (gen_random_uuid(), worker2_id, current_date - 1, 'Shift handover',        '14:00', '22:00', 38, 30, false);

end $$;

-- ── Teardown ──────────────────────────────────────────────────────────────────
-- Uncomment and run to reset all test data:

-- do $$
-- declare ids uuid[];
-- begin
--   select array_agg(id) into ids from auth.users
--     where email in ('admin@hoursplit.test','worker1@hoursplit.test','worker2@hoursplit.test');
--   if ids is not null then
--     delete from entries  where user_id = any(ids);
--     delete from settings where user_id = any(ids);
--     delete from invoices where user_id = any(ids);
--     delete from profiles where user_id = any(ids);
--   end if;
-- end $$;
-- delete from auth.users
--   where email in ('admin@hoursplit.test','worker1@hoursplit.test','worker2@hoursplit.test');
