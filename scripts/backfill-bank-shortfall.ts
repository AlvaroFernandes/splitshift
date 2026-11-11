// One-off: books the Hour Bank shortfall into bank weeks closed before short
// weeks were deducted from the bank (commit 8e77fae). Those closures froze
// their hours without the shortfall, so a 44h week on a 50h limit saved 0h
// instead of −6h.
//
//   npx tsx scripts/backfill-bank-shortfall.ts           # dry run
//   npx tsx scripts/backfill-bank-shortfall.ts --apply   # update closures
//
// Only closures whose saved hours equal the week's banked (positive) hours
// are touched — i.e. closures that are missing exactly the shortfall. Anything
// else is reported and left alone.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getEntries } from "../services/entries";
import { getInvoices } from "../services/invoices";
import { getBankClosures } from "../services/bankClosures";
import { getSettings, DEFAULT_SETTINGS } from "../services/settings";
import { processEntriesWithHistory } from "../lib/historicalProcessing";
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

const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;

async function main() {
  const { data: rows, error } = await supabase.from("bank_closures").select("user_id").eq("mode", "bank");
  if (error) throw error;
  const userIds = [...new Set((rows ?? []).map(r => r.user_id as string))];

  const { data: profiles } = await supabase.from("profiles").select("id, name, email").in("id", userIds);
  const nameOf = new Map((profiles ?? []).map(p => [p.id as string, (p.name || p.email || p.id) as string]));

  let updates = 0, skipped = 0;
  for (const uid of userIds) {
    const [entries, invoices, closures, settingsRow] = await Promise.all([
      getEntries(supabase, uid), getInvoices(supabase, uid), getBankClosures(supabase, uid), getSettings(supabase, uid),
    ]);
    const processed = processEntriesWithHistory(entries, settingsRow?.settings ?? DEFAULT_SETTINGS, invoices, closures);

    for (const c of closures.filter(c => c.mode === "bank").sort((a, b) => a.weekStart.localeCompare(b.weekStart))) {
      const week = processed.filter(e => weekStart(e.date) === c.weekStart);
      const banked    = week.reduce((s, e) => s + Math.max(0, e.bankHours), 0);
      const shortfall = week.reduce((s, e) => s + Math.min(0, e.bankHours), 0);
      if (shortfall === 0 || eq(c.hours, banked + shortfall)) continue; // nothing missing

      const label = `${nameOf.get(uid) ?? uid}  ${c.weekStart}`;
      if (!eq(c.hours, banked)) {
        skipped++;
        console.log(`SKIP  ${label}  saved ${c.hours.toFixed(2)}h, entries now bank ${banked.toFixed(2)}h (edited after closing?)`);
        continue;
      }
      const next = +(c.hours + shortfall).toFixed(6);
      updates++;
      console.log(`${apply ? "UPDATE" : "WOULD UPDATE"}  ${label}  ${c.hours.toFixed(2)}h → ${next.toFixed(2)}h  (short ${(-shortfall).toFixed(2)}h)`);
      if (apply) {
        const { error: upErr } = await supabase.from("bank_closures").update({ hours: next }).eq("id", c.id);
        if (upErr) { console.error(`  failed: ${upErr.message}`); process.exitCode = 1; }
      }
    }
  }
  console.log(`\n${updates} closure(s) ${apply ? "updated" : "to update"}, ${skipped} skipped.${apply ? "" : " Re-run with --apply to write."}`);
}

main().catch(err => { console.error(err); process.exit(1); });
