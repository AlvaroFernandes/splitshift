// Finds closed Hour Bank weeks whose saved hours no longer match their
// entries — entries edited, deleted or restored after the week was closed,
// before closures were recalculated on edit — and re-freezes them from the
// entries as they are now (the same figure the Weekly Report shows).
//
//   npx tsx scripts/resync-bank-closures.ts           # dry run
//   npx tsx scripts/resync-bank-closures.ts --apply   # update closures
//
// Closed weeks with no entries are skipped (they may be empty weeks charged
// to full-time workers by the Sunday cron).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getEntries } from "../services/entries";
import { getInvoices } from "../services/invoices";
import { getBankClosures } from "../services/bankClosures";
import { getSettings, DEFAULT_SETTINGS } from "../services/settings";
import { closedWeekBankHours } from "../lib/historicalProcessing";
import { weekStart } from "../lib/calculations";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const apply = process.argv.includes("--apply");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data: rows, error } = await supabase.from("bank_closures").select("user_id").eq("mode", "bank");
  if (error) throw error;
  const userIds = [...new Set((rows ?? []).map(r => r.user_id as string))];

  const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
  const nameOf = new Map((profiles ?? []).map(p => [p.user_id as string, (p.name || p.email || p.user_id) as string]));

  let changes = 0;
  for (const uid of userIds) {
    const [entries, invoices, closures, settingsRow] = await Promise.all([
      getEntries(supabase, uid), getInvoices(supabase, uid), getBankClosures(supabase, uid), getSettings(supabase, uid),
    ]);
    const settings = settingsRow?.settings ?? DEFAULT_SETTINGS;

    for (const c of closures.filter(c => c.mode === "bank").sort((a, b) => a.weekStart.localeCompare(b.weekStart))) {
      if (!entries.some(e => weekStart(e.date) === c.weekStart)) continue;
      const hours = +closedWeekBankHours(entries, settings, invoices, closures, c.weekStart).toFixed(6);
      if (Math.abs(hours - c.hours) < 1e-6) continue;

      changes++;
      const diff = hours - c.hours;
      console.log(`${apply ? "UPDATE" : "WOULD UPDATE"}  ${nameOf.get(uid) ?? uid}  ${c.weekStart}  ${c.hours.toFixed(2)}h → ${hours.toFixed(2)}h  (${diff > 0 ? "+" : ""}${diff.toFixed(2)}h)`);
      if (apply) {
        const { error: upErr } = await supabase.from("bank_closures").update({ hours }).eq("id", c.id);
        if (upErr) { console.error(`  failed: ${upErr.message}`); process.exitCode = 1; }
      }
    }
  }
  console.log(`\n${changes} closure(s) ${apply ? "updated" : "out of sync"}.${apply || !changes ? "" : " Re-run with --apply to write."}`);
}

main().catch(err => { console.error(err); process.exit(1); });
