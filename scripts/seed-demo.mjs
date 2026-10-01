// Demo data seed script
// Run: node --experimental-strip-types scripts/seed-demo.mjs
// Creates a separate demo admin with its own team (ABN, Hour Bank site and
// office workers, plus a read-only viewer) with 8 closed past weeks and the
// current week (up to today) still open. Past weeks are closed exactly as the
// app would: ABN weeks over the limit get a saved invoice, every other week a
// week closure (bank_closures) — so reports, invoices and the Hour Bank all
// line up. Uses the app's own calculation engine (lib/calculations.ts).
// Kept apart from the real admin so demo data never appears in real reports.
// Re-running it wipes and recreates every demo account.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import { processEntries } from "../lib/calculations.ts";

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

// ── Helpers ──────────────────────────────────────────────────────────────────
const pad   = n => String(n).padStart(2, "0");
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Monday of the week containing `d`
function monday(d) {
  const r = new Date(d);
  const day = r.getDay() === 0 ? 6 : r.getDay() - 1;
  r.setDate(r.getDate() - day);
  r.setHours(12, 0, 0, 0);
  return r;
}

// Generate Mon-Sun for `weeksBack` past weeks (not including current week)
function pastWeeks(weeksBack) {
  const weeks = [];
  const thisMonday = monday(new Date());
  for (let w = weeksBack; w >= 1; w--) {
    const mon = new Date(thisMonday);
    mon.setDate(mon.getDate() - w * 7);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(mon);
      day.setDate(day.getDate() + d);
      days.push(day);
    }
    weeks.push(days); // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  }
  return weeks;
}

// Mon–Sun of the current week
function currentWeek() {
  const mon = monday(new Date());
  return Array.from({ length: 7 }, (_, d) => { const day = new Date(mon); day.setDate(mon.getDate() + d); return day; });
}

function addDaysStr(date, n) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

// Mirrors closeWeek / createInvoice in hooks/useAppData.ts for every week
// before `thisMonday`: an ABN week with hours over the limit is invoiced (a
// saved invoice with its settings snapshot); any other week gets a closure
// record with the mode and settings it was closed under.
async function closePastWeeks(userId, s, rows, thisMonday) {
  const isBank   = s.excessMode === "bank";
  const tfnLimit = s.tfnLimit || 30;
  const tfnRate  = parseFloat(s.tfnRate || "") || undefined;
  const ot       = s.overtimeThreshold || 12;
  const processed = processEntries(rows.map(r => ({
    id: r.id, date: r.date, jobDescription: r.job_description, startTime: r.start_time, endTime: r.end_time,
    hourlyRate: r.hourly_rate, breakMins: r.break_mins, officeHours: r.office_hours, client: r.client ?? undefined,
  })), tfnLimit, tfnRate, ot, isBank ? "bank" : "abn");

  const byWeek = new Map();
  for (const e of processed) {
    const d = new Date(e.date + "T12:00:00");
    const ws = dateStr(monday(d));
    if (ws >= thisMonday) continue;
    if (!byWeek.has(ws)) byWeek.set(ws, []);
    byWeek.get(ws).push(e);
  }

  let invoiceNum = s.invoiceNum || 1;
  let invoices = 0, closures = 0;
  for (const [ws, week] of [...byWeek].sort(([a], [b]) => a.localeCompare(b))) {
    const we = addDaysStr(ws, 6);
    const needsInvoice = !isBank && week.some(e => e.abnPortion > 0);
    if (needsInvoice) {
      const invRows = [];
      for (const e of week) {
        if (e.rABN > 0)  invRows.push({ key: e.id + "-r",  entryId: e.id, date: e.date, startTime: e.startTime, description: e.jobDescription,                     client: e.client, rate: e.hourlyRate,       hours: e.rABN,  amount: e.rABN  * e.hourlyRate });
        if (e.otABN > 0) invRows.push({ key: e.id + "-ot", entryId: e.id, date: e.date, startTime: e.startTime, description: `${e.jobDescription} (overtime ×1.5)`, client: e.client, rate: e.hourlyRate * 1.5, hours: e.otABN, amount: e.otABN * e.hourlyRate * 1.5 });
      }
      const { error } = await supabase.from("invoices").insert({
        id: randomUUID(), user_id: userId, invoice_num: invoiceNum,
        issue_date: addDaysStr(we, 1), company_name: s.companyName || "",
        subtotal: invRows.reduce((a, r) => a + r.amount, 0),
        data: { settings: { ...s, invoiceNum, invoiceItems: [] }, rows: invRows, periodStart: ws, periodEnd: we },
      });
      if (error) { console.error(`  invoice error (${ws}):`, error.message); continue; }
      invoiceNum++; invoices++;
    } else {
      const { error } = await supabase.from("bank_closures").insert({
        user_id: userId, week_start: ws, week_end: we,
        hours: isBank ? week.reduce((a, e) => a + e.bankHours, 0) : 0,
        mode: isBank ? "bank" : "abn",
        tfn_limit: tfnLimit, tfn_rate: tfnRate ?? null, overtime_threshold: ot,
      });
      if (error) { console.error(`  closure error (${ws}):`, error.message); continue; }
      closures++;
    }
  }

  // Next invoice number continues after the seeded ones.
  if (invoices > 0) {
    await supabase.from("settings")
      .update({ data: { ...s, invoiceItems: [], templates: [], onboardingCompleted: true, invoiceNum } })
      .eq("user_id", userId);
  }
  return { invoices, closures };
}

// ── Worker definitions ───────────────────────────────────────────────────────
const WORKERS = [
  {
    name:   "Jake Thompson",
    email:  "jake.thompson@demo.splitshift.com.au",
    settings: {
      yourName: "Jake Thompson",
      abn: "51 824 753 556",
      yourAddress: "14 Anzac Parade, Kingsford NSW 2032",
      yourPhone: "0412 345 678",
      yourEmail: "jake.thompson@demo.splitshift.com.au",
      defaultRate: "58",
      tfnRate: "45",
      tfnLimit: 38,
      overtimeThreshold: 10,
      companyName: "BuildRight Constructions",
      companyAbn: "22 091 554 439",
      companyAddress: "1 George St, Sydney NSW 2000",
      bankName: "Commonwealth Bank",
      bsb: "062-015",
      accountNumber: "10234567",
      invoicePrefix: "JT",
      invoiceNum: 12,
      pdfNamePattern: "Invoice-{num}-{company}-{date}",
    },
    // [dayOfWeek (0=Mon), startTime, endTime, breakMins]
    schedule: [[0,"07:00","15:30",30],[1,"07:00","15:30",30],[2,"07:00","15:30",30],[3,"07:00","15:30",30],[4,"07:00","15:00",30]],
    rate: 58,
    jobs: ["Concreting works","Formwork installation","Site preparation","Structural steelwork","Demolition and strip-out","Slab pour","Scaffolding erection"],
    client: "BuildRight Constructions",
  },
  {
    name:   "Sarah Chen",
    email:  "sarah.chen@demo.splitshift.com.au",
    settings: {
      yourName: "Sarah Chen",
      abn: "38 647 291 803",
      yourAddress: "7 Collins St, Melbourne VIC 3000",
      yourPhone: "0423 456 789",
      yourEmail: "sarah.chen@demo.splitshift.com.au",
      defaultRate: "95",
      tfnRate: "70",
      tfnLimit: 20,
      overtimeThreshold: 10,
      companyName: "TechForward Solutions",
      companyAbn: "45 612 347 892",
      companyAddress: "100 Exhibition St, Melbourne VIC 3000",
      bankName: "ANZ Bank",
      bsb: "013-004",
      accountNumber: "23456789",
      invoicePrefix: "SC",
      invoiceNum: 8,
      gstRegistered: true,
      pdfNamePattern: "Invoice-{num}-{company}-{date}",
    },
    schedule: [[0,"09:00","17:30",30],[2,"09:00","17:30",30],[4,"09:00","17:30",30]],
    rate: 95,
    jobs: ["Backend API development","System architecture review","Code review and refactoring","Sprint planning session","Database optimisation","CI/CD pipeline setup","Technical documentation"],
    client: "TechForward Solutions",
  },
  {
    name:   "Emma Walsh",
    email:  "emma.walsh@demo.splitshift.com.au",
    settings: {
      yourName: "Emma Walsh",
      abn: "72 356 918 447",
      yourAddress: "22 Brunswick St, Fitzroy VIC 3065",
      yourPhone: "0434 567 890",
      yourEmail: "emma.walsh@demo.splitshift.com.au",
      defaultRate: "52",
      tfnRate: "45",
      tfnLimit: 38,
      overtimeThreshold: 8,
      companyName: "CityHealth Services",
      companyAbn: "61 428 735 901",
      companyAddress: "250 Flinders St, Melbourne VIC 3000",
      bankName: "Westpac",
      bsb: "033-002",
      accountNumber: "34567890",
      invoicePrefix: "EW",
      invoiceNum: 15,
      pdfNamePattern: "Invoice-{num}-{company}-{date}",
    },
    schedule: [[1,"07:00","15:00",30],[2,"07:00","15:00",30],[3,"07:00","15:00",30],[4,"07:00","15:00",30]],
    rate: 52,
    jobs: ["Patient care and support","Wound management","Medication administration","Clinical handover","Ward rounds assistance","Post-op monitoring","Health assessment"],
    client: "CityHealth Services",
  },
  {
    name:   "Marcus Rivera",
    email:  "marcus.rivera@demo.splitshift.com.au",
    settings: {
      yourName: "Marcus Rivera",
      abn: "94 201 568 374",
      yourAddress: "5 Foveaux St, Surry Hills NSW 2010",
      yourPhone: "0445 678 901",
      yourEmail: "marcus.rivera@demo.splitshift.com.au",
      defaultRate: "78",
      tfnRate: "60",
      tfnLimit: 25,
      overtimeThreshold: 9,
      companyName: "Creative Studio Co",
      companyAbn: "33 712 456 890",
      companyAddress: "88 Pitt St, Sydney NSW 2000",
      bankName: "NAB",
      bsb: "083-004",
      accountNumber: "45678901",
      invoicePrefix: "MR",
      invoiceNum: 6,
      pdfNamePattern: "Invoice-{num}-{company}-{date}",
    },
    schedule: [[0,"08:30","17:00",30],[1,"08:30","17:00",30],[2,"08:30","17:00",30],[3,"08:30","17:00",30]],
    rate: 78,
    jobs: ["Brand identity design","UI/UX mockups","Social media asset creation","Pitch deck design","Print collateral","Motion graphics","Design system documentation"],
    client: "Creative Studio Co",
  },
  // Hour Bank — Site: excess hours bank instead of going to an ABN invoice,
  // but still logs full entries (job description, client, rate) like the
  // ABN workers above.
  {
    name:   "Liam Carter",
    email:  "liam.carter@demo.splitshift.com.au",
    settings: {
      yourName: "Liam Carter",
      yourAddress: "9 Wattle St, Parramatta NSW 2150",
      yourPhone: "0456 789 012",
      yourEmail: "liam.carter@demo.splitshift.com.au",
      defaultRate: "45",
      tfnRate: "45",
      tfnLimit: 38,
      overtimeThreshold: 8,
      excessMode: "bank",
      workerType: "site",
      companyName: "BuildRight Constructions",
      companyAbn: "22 091 554 439",
      companyAddress: "1 George St, Sydney NSW 2000",
      pdfNamePattern: "Invoice-{num}-{company}-{date}",
    },
    schedule: [[0,"07:00","15:30",30],[1,"07:00","15:30",30],[2,"07:00","15:30",30],[3,"07:00","15:30",30],[4,"07:00","15:30",30]],
    rate: 45,
    jobs: ["Electrical rough-in","Cabling and conduit runs","Switchboard installation","Fault finding","Fit-off and testing"],
    client: "BuildRight Constructions",
  },
  // Hour Bank — Office: simplified clock-in/out entries only (no job
  // description, client or per-entry rate — see components/LogEntry.tsx).
  {
    name:   "Olivia Bennett",
    email:  "olivia.bennett@demo.splitshift.com.au",
    settings: {
      yourName: "Olivia Bennett",
      yourAddress: "40 King St, Newtown NSW 2042",
      yourPhone: "0467 890 123",
      yourEmail: "olivia.bennett@demo.splitshift.com.au",
      defaultRate: "32",
      tfnRate: "32",
      tfnLimit: 38,
      overtimeThreshold: 8,
      excessMode: "bank",
      workerType: "office",
      companyName: "BuildRight Constructions",
      companyAbn: "22 091 554 439",
      companyAddress: "1 George St, Sydney NSW 2000",
      pdfNamePattern: "Invoice-{num}-{company}-{date}",
    },
    schedule: [[0,"09:00","17:00",60],[1,"09:00","17:00",60],[2,"09:00","17:00",60],[3,"09:00","17:00",60],[4,"09:00","17:00",60]],
    rate: 32,
    officeClock: true, // forces fixed job description, no client, office_hours on every entry
  },
];

// Viewer (accountant) — read-only access to the admin's whole team, no
// entries or settings of their own.
const VIEWERS = [
  { name: "Priya Nair", email: "priya.nair@demo.splitshift.com.au" },
];

// Demo admin — owns the demo team, separate from any real admin account.
const DEMO_ADMIN = { name: "Demo Admin", email: "admin@demo.splitshift.com.au" };
const DEMO_PASSWORD = "Demo@SplitShift2026!";

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Clean up any existing demo accounts (admin, workers, viewers)
  const demoEmails = [DEMO_ADMIN.email, ...WORKERS.map(w => w.email), ...VIEWERS.map(v => v.email)];
  const { data: existing } = await supabase
    .from("profiles").select("user_id").in("email", demoEmails);
  if (existing?.length) {
    const ids = existing.map(p => p.user_id);
    for (const table of ["entries", "invoices", "bank_closures", "settings"]) {
      await supabase.from(table).delete().in("user_id", ids);
    }
    await supabase.from("audit_log").delete().in("admin_id", ids);
    // Workers before the admin they point to (profiles.admin_id).
    await supabase.from("profiles").delete().in("user_id", ids).neq("role", "admin");
    await supabase.from("profiles").delete().in("user_id", ids);
    for (const id of ids) await supabase.auth.admin.deleteUser(id);
    console.log(`Cleaned up ${ids.length} existing demo account(s).`);
  }

  // 2. Create the demo admin
  const { data: adminAuth, error: adminErr } = await supabase.auth.admin.createUser({
    email: DEMO_ADMIN.email, password: DEMO_PASSWORD, email_confirm: true,
  });
  if (adminErr) { console.error("Auth error for demo admin:", adminErr.message); process.exit(1); }
  const adminId = adminAuth.user.id;
  await supabase.from("profiles").upsert({
    user_id: adminId, name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, role: "admin", admin_id: null,
  }, { onConflict: "user_id" });
  await supabase.from("settings").upsert({
    user_id: adminId,
    data: { companyName: "Hands On Labour", yourName: DEMO_ADMIN.name, onboardingCompleted: true },
  });
  console.log(`✓ ${DEMO_ADMIN.name} — admin account created`);

  const weeks = [...pastWeeks(8), currentWeek()];
  const thisMonday = dateStr(weeks[weeks.length - 1][0]);

  for (const worker of WORKERS) {
    // 3. Create real auth user (needed for foreign key on entries table)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email:             worker.email,
      password:          DEMO_PASSWORD,
      email_confirm:     true,
      user_metadata:     { invited_role: "user", invited_by: adminId },
    });
    if (authErr) { console.error(`Auth error for ${worker.name}:`, authErr.message); continue; }
    const workerId = authData.user.id;

    // Upsert profile (DB trigger may have already created one)
    await supabase.from("profiles").upsert({
      user_id:  workerId,
      name:     worker.name,
      email:    worker.email,
      role:     "user",
      admin_id: adminId,
    }, { onConflict: "user_id" });

    // 4. Create settings
    await supabase.from("settings").insert({
      user_id:      workerId,
      data:         { ...worker.settings, invoiceItems: [], templates: [], onboardingCompleted: true },
      period_start: dateStr(weeks[0][0]),
      period_end:   dateStr(weeks[weeks.length - 1][6]),
    });

    // 5. Create entries — one per scheduled day per week
    const entries = [];
    let jobIdx = 0;
    for (const week of weeks) {
      for (const [dayOfWeek, start, end, brk] of worker.schedule) {
        const day = week[dayOfWeek];
        // Skip if in the future
        if (day > new Date()) continue;
        const date = dateStr(day);
        entries.push({
          id:              randomUUID(),
          user_id:         workerId,
          date,
          job_description: worker.officeClock ? "Office hours" : worker.jobs[jobIdx % worker.jobs.length],
          start_time:      start,
          end_time:        end,
          hourly_rate:     worker.rate,
          break_mins:      brk,
          archived:        date < thisMonday, // past weeks closed, current week open
          office_hours:    !!worker.officeClock,
          client:          worker.officeClock ? null : worker.client,
          deleted_at:      null,
        });
        jobIdx++;
      }
    }

    const { error } = await supabase.from("entries").insert(entries);
    if (error) { console.error(`Entries error for ${worker.name}:`, error.message); continue; }

    // 6. Close every past week the way the app does
    const closed = await closePastWeeks(workerId, worker.settings, entries, thisMonday);
    console.log(`✓ ${worker.name} — ${entries.length} entries, ${closed.invoices} invoice(s), ${closed.closures} closed week(s) without invoice`);
  }

  // 7. Create viewer (accountant) accounts — read-only, no settings/entries
  for (const viewer of VIEWERS) {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email:         viewer.email,
      password:      DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { invited_role: "viewer", invited_by: adminId },
    });
    if (authErr) { console.error(`Auth error for ${viewer.name}:`, authErr.message); continue; }

    await supabase.from("profiles").upsert({
      user_id:  authData.user.id,
      name:     viewer.name,
      email:    viewer.email,
      role:     "viewer",
      admin_id: adminId,
    }, { onConflict: "user_id" });

    console.log(`✓ ${viewer.name} — viewer account created`);
  }

  console.log(`\nDemo data seeded. Log in as ${DEMO_ADMIN.email} to see the whole team, or as any worker.`);
}

main().catch(e => { console.error(e); process.exit(1); });
