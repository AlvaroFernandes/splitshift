// Demo data seed script
// Run: node scripts/seed-demo.mjs
// Creates 4 demo workers under your admin account with 8 weeks of realistic entries.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";

// ── Load .env.local ──────────────────────────────────────────────────────────
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { NEXT_PUBLIC_SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY, ADMIN_EMAIL } = process.env;
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
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Find admin user
  const adminEmail = ADMIN_EMAIL || "fernandes.alvaro@gmail.com";
  const { data: adminProfile } = await supabase
    .from("profiles").select("user_id").eq("email", adminEmail).maybeSingle();

  if (!adminProfile) {
    console.error(`Admin profile not found for ${adminEmail}. Make sure you have logged in at least once.`);
    process.exit(1);
  }
  const adminId = adminProfile.user_id;
  console.log(`Admin found: ${adminEmail} (${adminId})`);

  // 2. Clean up any existing demo workers
  const demoEmails = WORKERS.map(w => w.email);
  const { data: existing } = await supabase
    .from("profiles").select("user_id").in("email", demoEmails);
  if (existing?.length) {
    const ids = existing.map(p => p.user_id);
    await supabase.from("entries").delete().in("user_id", ids);
    await supabase.from("settings").delete().in("user_id", ids);
    await supabase.from("profiles").delete().in("user_id", ids);
    for (const id of ids) await supabase.auth.admin.deleteUser(id);
    console.log(`Cleaned up ${ids.length} existing demo worker(s).`);
  }

  const weeks = pastWeeks(8);

  for (const worker of WORKERS) {
    // 3. Create real auth user (needed for foreign key on entries table)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email:             worker.email,
      password:          "Demo@SplitShift2026!",
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
      data:         { ...worker.settings, invoiceItems: [], templates: [] },
      period_start: dateStr(weeks[0][0]),
      period_end:   dateStr(weeks[weeks.length - 1][4]),
    });

    // 5. Create entries — one per scheduled day per week
    const entries = [];
    let jobIdx = 0;
    for (const week of weeks) {
      for (const [dayOfWeek, start, end, brk] of worker.schedule) {
        const day = week[dayOfWeek];
        // Skip if in the future
        if (day > new Date()) continue;
        entries.push({
          id:              randomUUID(),
          user_id:         workerId,
          date:            dateStr(day),
          job_description: worker.jobs[jobIdx % worker.jobs.length],
          start_time:      start,
          end_time:        end,
          hourly_rate:     worker.rate,
          break_mins:      brk,
          archived:        false,
          office_hours:    false,
          client:          worker.client,
          deleted_at:      null,
        });
        jobIdx++;
      }
    }

    const { error } = await supabase.from("entries").insert(entries);
    if (error) console.error(`Entries error for ${worker.name}:`, error.message);
    else console.log(`✓ ${worker.name} — ${entries.length} entries created`);
  }

  console.log("\nDemo data seeded successfully. Log in as admin to see all workers.");
}

main().catch(e => { console.error(e); process.exit(1); });
