// Onboarding demo user
// Run: node scripts/seed-onboarding-user.mjs
// Creates brand-new workers with no name, entries or completed onboarding, so
// logging in shows the onboarding wizard: one ABN worker and two Hour Bank
// (TFN only) workers, site and office. Re-run it to reset the accounts and see
// onboarding again after completing or skipping it.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

// ── Load .env.local ──────────────────────────────────────────────────────────
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { NEXT_PUBLIC_SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!URL || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const supabase = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = "Demo@SplitShift2026!";

// `settings` holds only the admin-set work mode; null means no settings row
// (defaults to ABN).
const USERS = [
  { email: "new.user@demo.splitshift.com.au",        label: "ABN",          settings: null },
  { email: "new.tfn.site@demo.splitshift.com.au",    label: "TFN — site",   settings: { excessMode: "bank", workerType: "site" } },
  { email: "new.tfn.office@demo.splitshift.com.au",  label: "TFN — office", settings: { excessMode: "bank", workerType: "office" } },
];

async function main() {
  // 1. Remove previous copies, if any
  const { data: existing } = await supabase.from("profiles").select("user_id").in("email", USERS.map(u => u.email));
  for (const { user_id } of existing ?? []) {
    for (const table of ["entries", "invoices", "bank_closures", "settings"]) {
      await supabase.from(table).delete().eq("user_id", user_id);
    }
    await supabase.from("profiles").delete().eq("user_id", user_id);
    await supabase.auth.admin.deleteUser(user_id);
  }
  if (existing?.length) console.log(`Removed ${existing.length} existing onboarding user(s).`);

  for (const u of USERS) {
    // 2. Create a fresh worker — no name, so onboarding is pending
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email, password: PASSWORD, email_confirm: true,
      user_metadata: { invited_role: "user" },
    });
    if (error) { console.error(`Auth error for ${u.email}:`, error.message); continue; }

    // Profile (DB trigger may have already created one)
    await supabase.from("profiles").upsert({
      user_id: data.user.id, email: u.email, role: "user", admin_id: null,
    }, { onConflict: "user_id" });

    if (u.settings) {
      const { error: sErr } = await supabase.from("settings").insert({ user_id: data.user.id, data: u.settings });
      if (sErr) { console.error(`Settings error for ${u.email}:`, sErr.message); continue; }
    }

    console.log(`✓ ${u.label.padEnd(12)} ${u.email}`);
  }
  console.log(`\nPassword for all: ${PASSWORD}`);
}

main().catch(e => { console.error(e); process.exit(1); });
