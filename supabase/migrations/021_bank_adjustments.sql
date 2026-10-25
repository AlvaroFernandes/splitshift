-- 021_bank_adjustments.sql
-- Manual changes to a worker's Hour Bank balance made by their admin —
-- typically recording that some banked hours have been paid out, so they
-- come off the balance. hours is signed: negative deducts (payout), positive
-- adds (correction). Kept separate from bank_closures so weekly accruals stay
-- a frozen record and every adjustment has its own date, note and author.

CREATE TABLE IF NOT EXISTS bank_adjustments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date        NOT NULL,
  hours       numeric     NOT NULL CHECK (hours <> 0),
  note        text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_adjustments_user_date_idx
  ON bank_adjustments(user_id, date DESC);

ALTER TABLE bank_adjustments ENABLE ROW LEVEL SECURITY;

-- Worker sees their own adjustments (read-only)
CREATE POLICY "bank_adjustments_own_select" ON bank_adjustments
  FOR SELECT USING (user_id = auth.uid());

-- Admins/viewers can read their managed workers' adjustments
CREATE POLICY "bank_adjustments_admin_select" ON bank_adjustments
  FOR SELECT USING ((is_admin() OR is_viewer()) AND manages_user(user_id));

-- Only admins record or remove adjustments, for workers they manage
CREATE POLICY "bank_adjustments_admin_insert" ON bank_adjustments
  FOR INSERT WITH CHECK (is_admin() AND manages_user(user_id) AND created_by = auth.uid());

CREATE POLICY "bank_adjustments_admin_delete" ON bank_adjustments
  FOR DELETE USING (is_admin() AND manages_user(user_id));
