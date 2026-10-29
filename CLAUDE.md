# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build (also type-checks)
npm run lint     # ESLint
npm run start    # serve the production build
```

## Architecture

Single-page app built with Next.js 16 App Router. Auth is handled server-side in `proxy.ts` (Next.js 16 middleware). All data is persisted to Supabase (entries, settings, invoices, profiles).

**Key files:**

- `components/WorkHoursTracker.tsx` — root shell: calls `useAppData`, renders layout + tab routing
- `hooks/useAppData.ts` — all app state, effects, and handlers; no Supabase calls here
- `services/` — all Supabase queries, one file per domain:
  - `entries.ts` — CRUD for work entries
  - `settings.ts` — settings + period persistence; exports `DEFAULT_SETTINGS`
  - `profiles.ts` — user profiles, roles, admin → worker relationships
  - `invoices.ts` — saved invoice history
- `lib/calculations.ts` — pure `processEntries` calculation engine; exports `calcHours`, `MIN_HOURS`
- `lib/formatters.ts` — display helpers: `fh` (hours), `fc` (currency), `fd`/`fdInv` (dates), PDF utilities
- `lib/supabase.ts` — browser Supabase client (`createBrowserClient`)
- `lib/supabase-server.ts` — server Supabase client for Server Components / Route Handlers
- `types/index.ts` — all TypeScript interfaces
- `proxy.ts` — Next.js 16 auth proxy: redirects unauthenticated requests to `/login`
- `app/globals.css` — CSS custom properties (design tokens for light/dark mode) and all app-shell styles
- `app/layout.tsx` — Geist fonts, metadata
- `app/login/page.tsx` — Supabase Auth UI login page

**UI components** (`components/`):

| File | Contents |
|---|---|
| `Dashboard.tsx` | Metrics grid + recent days summary (admin and user views) |
| `LogEntry.tsx` | Add / edit entry form with live earnings preview |
| `EntriesList.tsx` | Sortable entries table with per-user filter for admins |
| `WeeklyReport.tsx` | Weekly breakdown table + printable timesheet PDF |
| `TFNReport.tsx` | TFN salary timesheet (printable) |
| `ABNInvoice.tsx` | ABN tax invoice with extra-items manager + PDF download |
| `InvoiceHistory.tsx` | Saved invoice list + `SavedInvoiceDoc` viewer |
| `AdminEditModal.tsx` | Overlay form for admin editing a worker's entry |
| `SettingsPage.tsx` | Tabbed settings form (Personal, Company, Payment) |
| `TeamPage.tsx` | Admin Team tab: invites, per-worker work rules, edit details, remove/restore access |
| `ui.tsx` | `Metric` card and `Bdg` (TFN/ABN/OT) badge primitives |

**Calculation engine (`processEntries` in `lib/calculations.ts`):**

Entries are sorted chronologically, then processed in a single pass with two independent splits:
- **Overtime** — hours beyond `overtimeThreshold` in a single entry → rate ×1.5
- **TFN/ABN** — first `tfnLimit` cumulative hours → TFN salary; excess → ABN invoice (per Mon–Sun week, or per calendar month for Hour Bank workers with `limitPeriod: "month"` — see `limitPeriodOf`)

The intersection produces four buckets per entry: `rTFN`, `otTFN`, `rABN`, `otABN`. Sequential order matters because TFN/ABN allocation is cumulative across the period.

**User roles:**

- `user` — standard worker; has all tabs (Dashboard, Log Entry, Entries, Weekly Report, TFN Report, ABN Invoice, Invoices)
- `admin` — managed via `profiles` table (`role = 'admin'`); sees combined entries for all workers under them; no Log Entry / TFN Report / ABN Invoice tabs
- `viewer` — read-only accountant: Dashboard, Entries, Weekly Report for the whole team
- Workers with `profiles.team_access` ("Accountant access", set on the Team tab) keep their own tabs plus read-only Team Report / Team Invoices; RLS treats them as viewers via `is_viewer()`

**Tabs:** Dashboard · Log Entry · Entries · Weekly Report · TFN Report · ABN Invoice · Invoices

**Styling approach:** Plain CSS class names (`.card`, `.metric-grid`, `.data-table`, etc.) defined in `globals.css`. Tailwind is available but not used — keep this consistent. Design tokens follow the pattern `--color-{background|border|text}-{semantic}`.

**Icons:** `@tabler/icons-webfont` — use `<i className="ti ti-{icon-name}" />`.

**Currency/locale:** Australian (AUD, `en-AU`). GST on ABN invoices is 10%.
