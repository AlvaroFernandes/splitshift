-- 020_week_closures_mode.sql
-- An ABN week that never exceeded the TFN limit is closed without an
-- invoice, so until now nothing recorded the mode/settings that governed
-- it. Reports then fell back to the worker's *current* settings, so after a
-- switch to Hour Bank those weeks were relabeled and reprocessed as bank
-- weeks. bank_closures now records every week closed via closeWeek(), with
-- the mode it was closed under.

ALTER TABLE bank_closures
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'bank'
    CHECK (mode IN ('abn', 'bank'));
