-- 016_bank_closures.sql
-- Permanent record of Hour Bank weeks closed via closeWeek(), mirroring what
-- the invoices table already does for ABN weeks. Without this, a worker's
-- Hour Bank balance would be recomputed under their *current* excessMode,
-- silently mislabeling past weeks if they ever switch between ABN and Bank.

CREATE TABLE IF NOT EXISTS bank_closures (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date        NOT NULL,
  week_end    date        NOT NULL,
  hours       numeric     NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS bank_closures_user_week_idx
  ON bank_closures(user_id, week_start DESC);

ALTER TABLE bank_closures ENABLE ROW LEVEL SECURITY;

-- Worker sees and inserts their own closures
CREATE POLICY "bank_closures_own_select" ON bank_closures
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "bank_closures_own_insert" ON bank_closures
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins/viewers can read their managed workers' closures (Weekly Report, etc.)
CREATE POLICY "bank_closures_admin_select" ON bank_closures
  FOR SELECT USING ((is_admin() OR is_viewer()) AND manages_user(user_id));
