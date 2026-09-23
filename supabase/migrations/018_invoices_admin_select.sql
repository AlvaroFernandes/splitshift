-- 018_invoices_admin_select.sql
-- Admin/viewer read access to managed workers' invoices, mirroring the
-- bank_closures_admin_select policy. Without this, the admin Weekly Report
-- has no way to know which weeks a worker actually invoiced (ABN) under,
-- so it cannot label historical weeks with the mode/settings that were
-- frozen at invoicing time — it can only guess from the worker's current
-- settings, silently mislabeling weeks after a worker switches modes.

drop policy if exists "invoices_admin_select" on invoices;

create policy "invoices_admin_select" on invoices
  for select using ((is_admin() or is_viewer()) and manages_user(user_id));
