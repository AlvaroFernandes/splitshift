-- 017_bank_closures_settings_snapshot.sql
-- Freezes the TFN limit/rate/overtime threshold that were actually in effect
-- when a bank week was closed, mirroring what invoices.data.settings already
-- does for ABN weeks. Without this, a worker's Weekly Report would recompute
-- past bank weeks under whatever settings are current today, silently
-- rewriting history if the admin later changes the worker's rate or limit.

ALTER TABLE bank_closures
  ADD COLUMN IF NOT EXISTS tfn_limit          numeric,
  ADD COLUMN IF NOT EXISTS tfn_rate           numeric,
  ADD COLUMN IF NOT EXISTS overtime_threshold numeric;
