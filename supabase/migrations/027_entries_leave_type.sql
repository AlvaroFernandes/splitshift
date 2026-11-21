-- 027_entries_leave_type.sql
-- Leave days for full-time Hour Bank workers: an entry can be a paid day off
-- (annual leave, sick leave or public holiday) instead of worked time. It is
-- stored like a shift from 00:00 to the leave hours (weekly hours ÷ 5), so
-- every calculation counts it toward the TFN / Hour Bank limit.

alter table entries add column if not exists leave_type text
  check (leave_type in ('annual', 'sick', 'public_holiday'));
