-- 024_bank_closures_limit_period.sql
-- Hour Bank workers can now have a monthly TFN limit instead of a weekly one.
-- Freeze which period the limit covered when a week was closed, alongside the
-- tfn_limit snapshot from 017. Existing rows were all closed under weekly
-- limits, so null means "week".

ALTER TABLE bank_closures
  ADD COLUMN IF NOT EXISTS limit_period text
  CHECK (limit_period IN ('week', 'month'));
