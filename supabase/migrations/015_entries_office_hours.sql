-- Office hours flag on entries: skips the 4-hour minimum call rule.
-- Run in the Supabase SQL editor.

alter table entries add column if not exists office_hours boolean not null default false;
