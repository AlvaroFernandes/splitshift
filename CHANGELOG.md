# Changelog

All notable changes to HourSplit are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.5.44] - 2026-05-23

### Added

- **Office hours flag on entries** — a checkbox on the Log Entry form (and admin edit modal) marks a shift as office hours. When set, the 4-hour minimum call rule is bypassed and only actual worked time is billed. The live earnings preview updates instantly to reflect this.
- Migration `015_entries_office_hours.sql` adds an `office_hours boolean DEFAULT false` column to the `entries` table — run it in the Supabase SQL editor to activate persistence.

---

## [0.5.43] - 2026-05-21

### Added

- **Hour Bank profile mode** — users can now choose between two excess-hours modes in Settings → Work Rules:
  - **ABN Invoice** (default) — hours beyond the weekly TFN limit are billed as an ABN invoice, unchanged from previous behaviour.
  - **Hour Bank** — excess hours are banked (tracked but not invoiced). ABN earnings are zero; a "Hour Bank" metric replaces the ABN metric on the Dashboard. The ABN Invoice and Invoices tabs are hidden when this mode is active.
- Admins can set the excess-hours mode per worker from Settings → Work Rules (new "Excess hours" dropdown column).
- New `bank` badge type (purple) used in the Dashboard recent days table when Hour Bank mode is active.
- Work Rules settings tab is now fully functional for non-admin users: TFN limit, overtime threshold and excess mode are all editable.

---

## [0.5.42] - 2026-05-21

### Fixed

- **Earnings chart value labels clipped at top** — added 18 px top padding to the chart SVG so labels above tall bars are no longer cut off by the container. Previously the tallest bar could push its label to a negative y-coordinate, causing it to be hidden.

---

## [0.5.41] - 2026-05-21

### Changed

- **Earnings chart x-axis labels** — bar labels now render on two lines: month (or day + month for weekly) on top, full 4-digit year below. Previously the monthly view showed a cramped "May 26" (2-digit year) and the weekly view showed "18 May" with no year at all.

---

## [0.5.40] - 2026-05-20

### Changed

- **App renamed to HourSplit** — all user-visible and internal references updated: page title, PWA manifest, login screen, app header, onboarding wizard, admin CSV export header and filename prefix, `package.json` name, seed data test emails and company name.

---

## [0.5.39] - 2026-05-18

### Fixed / Security

- **Double-submit protection on Log Entry** — the Save/Update button now disables itself and shows a spinner while the async save is in-flight; a guard at the top of `handleSubmit` also prevents re-entry if the state update races. Prevents duplicate entries from rapid clicks.
- **`init()` error handling** — the app-data initialisation function is now wrapped in a try/catch; a network failure or Supabase error on load now shows a "Failed to load your data. Please refresh the page." toast and sets `loading = false`, instead of leaving the UI frozen on a blank loading screen indefinitely.
- **`advanceInvoice` atomicity** — if the entry-archiving step fails after the invoice has already been saved, the invoice is now rolled back (`deleteInvoice` called) before showing the error. Prevents the double-invoicing scenario where an invoice exists in history for entries that were never archived.
- **Invoice token enumeration protection** — `proxy.ts` now validates that `/invoice/<token>` paths contain a well-formed UUIDv4 before passing the request to the page handler; non-UUID strings (enumeration probes, crawler noise) are immediately redirected to `/login` without touching the database.

### Added

- **Unit tests** — Vitest added as a dev dependency; `__tests__/calculations.test.ts` covers 23 cases across the full calculation engine:
  - `calcHours`: standard shifts, half-hour, overnight, midnight edge cases, empty input
  - `weekStart`: each day of the week, Sunday wraparound, DST boundary (Australia/Sydney March 2026)
  - `processEntries`: 4h minimum call, all-TFN, TFN/ABN split, multi-entry weekly accumulation, weekly TFN reset, overtime, combined overtime+TFN/ABN split, separate TFN rate, break deduction, sort-order correctness
- **`npm test`** script added; CI pipeline updated to run tests before the build step on every push and PR.

---

## [0.5.38] - 2026-05-18

### Fixed / Security

- **Auth proxy confirmed active** — Next.js 16 uses `proxy.ts` (not the older `middleware.ts` convention); `proxy.ts` with `export function proxy` was already correct and registered. Audit note corrected.
- **HSTS header added** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` added to `next.config.ts`; enforces HTTPS for 2 years and allows HSTS preload list submission.

### Added

- **Global error boundary** — `app/error.tsx` added; unhandled React errors now show a friendly "Something went wrong / Try again" card instead of crashing the entire UI.
- **Health-check endpoint** — `GET /api/health` returns `{ status: "ok", ts: <epoch> }` on the edge runtime; ready for load-balancer and uptime-monitoring integrations.
- **`.env.example`** — documents all three required environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) with instructions on where to find each in the Supabase dashboard.
- **GitHub Actions CI pipeline** — `.github/workflows/ci.yml` runs `npm ci` + `next build` (type-check included) on every push to `main` and every PR; uses placeholder env vars so the build completes without live Supabase credentials.

---

## [0.5.37] - 2026-05-18

### Performance

- **Tailwind import** — `@import "tailwindcss"` retained in `globals.css`; Turbopack resolves this as a PostCSS directive (handled by `@tailwindcss/postcss`), not as a JS module. Attempting to narrow it to `tailwindcss/preflight` caused a module resolution error at runtime.
- **Table hover repaint scoped** — added `contain: paint` to `.data-table` so hover repaints are bounded to the table element and can't cause ancestor-level redraws; changed `background` shorthand → `background-color` on the hover rule (avoids resetting background-image/gradient/etc sub-properties that aren't set).
- **SVG chart opacity unified** — replaced the mixed `opacity` presentation attribute (admin bars) / `style.opacity` (worker bars) / `style.opacity` (legend swatches) with a single `FILL_OPACITY` constant and the more semantically correct `fillOpacity` SVG attribute on all bar rects; `fillOpacity` affects only the fill channel, not the element itself, so no future text sibling placed inside a `<g>` can accidentally inherit it. Legend swatches remain consistent via the same constant.

---

## [0.5.36] - 2026-05-18

### Performance

- **Dashboard O(n·m) loops eliminated** — `downloadAdminCSV` now pre-builds `byUser` and `workerMap` Maps before iterating, replacing per-user `processed.filter()` and per-entry `users.find()` calls with O(1) Map lookups. `userStats` aggregation switched from a filter-per-user loop to a single O(n) pass; `userMap` added as a memoised `Map<id, name>` so the Recent days render also avoids repeated linear scans.
- **EntriesList O(n·m) render and CSV fixed** — `userMap` memoised as `Map<id, name>`; table row lookup and `downloadEntriesCSV` both use the Map instead of `users?.find()` per row.
- **SettingsPage workerRules stable setter** — the `useEffect` that derives worker rule rows now uses a setter function with a structural equality check; if the derived array is identical to the previous one (same length, same userId/tfnLimit/overtimeThreshold per position) it returns the existing reference, preventing a downstream re-render.
- **AdminEditModal preview memoised** — `breakMinsNum`, `previewRaw`, `previewActual`, `previewH`, `previewEarn` wrapped in `useMemo` keyed on `[form.breakMins, form.startTime, form.endTime, form.hourlyRate]`; preview no longer recomputes when other fields (date, job description, client) change. JSX now references `previewEarn` directly instead of recomputing the expression inline.
- **html2canvas scale reduced** — `scale: 2` → `scale: 1.5` in `downloadPdf`; reduces the off-screen canvas pixel count from 4× to 2.25× the element's CSS size, cutting peak main-thread memory use during PDF export.
- **byDate sort optimised** — replaced `.sort().reverse()` with a single `.sort((a, b) => b.localeCompare(a))` pass in `Dashboard.tsx`.

---

## [0.5.35] - 2026-05-18

### Performance

- **Supabase `SELECT *` eliminated** — all profile queries now select only the columns actually consumed (`user_id, name, email` for list queries; `role, admin_id` for profile lookup); the inline viewer refresh in `handleInvite` also narrowed. Reduces per-query payload and avoids sending any future columns to the client automatically.
- **Audit log fetch narrowed** — `getAuditLog` now selects explicit columns instead of `*`, and the default fetch limit drops from 200 → 100 rows; halves the initial admin load on large teams.
- **`saveSettings` stale closure fixed** — `showToast` added to the `useCallback` dependency array in `useAppData.ts`; since `showToast` is itself stable (empty-dep callback) this has no runtime cost but eliminates the hidden closure risk if the callback ever gains deps in future.

---

## [0.5.34] - 2026-05-17

### Performance / Fixed

- **weekStart() consolidated** — removed two duplicate local implementations (one DST-unsafe, using midnight) from `EarningsChart.tsx` and `WeeklyReport.tsx`; both now import the single noon-anchored version from `lib/calculations.ts`. Eliminates a data-integrity risk where entries on a DST boundary could land in the wrong invoice week.
- **Form state moved local to LogEntry** — `form` and `setForm` removed from `useAppData.ts` (was 1 of the 23 top-level `useState` calls); `LogEntry` now owns its own form state. Every keystroke in the log form previously caused a full app re-render (Dashboard, EntriesList, WeeklyReport, etc.); now only `LogEntry` re-renders. `handleSave` and `handleSaveTemplate` accept `FormState` as a parameter. `editEntry` (derived from `editId` + `entries`) is passed down instead of `form/setForm/editId`; `key={editEntry?.id ?? "new"}` on `LogEntry` ensures the form resets cleanly on save or cancel. Preview calculations are now `useMemo`-wrapped so they only recompute when the relevant fields change.
- **Toast timer leak fixed** — `showToast` now clears any pending `setTimeout` before scheduling a new one (rapid successive toasts no longer accumulate orphaned timers); the timer is also cleaned up on unmount via `useEffect` return.
- **ABNInvoice invoice computation memoized** — all entry filtering, week grouping, row building, sorting, and totals calculation wrapped in `useMemo` keyed on `[processed, settings.invoiceItems, settings.gstRegistered]`; typing in the extra-items form or toggling the download state no longer re-runs O(n log n) work on every keystroke.
- **WeeklyReport week grouping memoized** — `weekMap` / `weeks` / `grandTotal` wrapped in `useMemo` keyed on `[visible]`; toggling a row's expand arrow no longer re-runs the full aggregation on every render.

---

## [0.5.33] - 2026-05-17

### Added
- **Entries CSV export** — "CSV" download button on the Entries tab exports the currently visible rows (respects user filter and client filter)
  - Workers get: Date, Job Description, Client, Start, End, Break, Hours, Rate, TFN/ABN/OT hours, TFN/ABN/Total earnings
  - Admin view adds a Worker column
  - Button appears in the filter bar when filters are present, or as a standalone row above the table otherwise; disabled when no rows are visible
  - Client-side only, no API required; filename includes today's date

---

## [0.5.32] - 2026-05-17

### Added
- **Worker self-onboarding wizard** — new workers see a 3-step setup modal on first login instead of landing on a blank dashboard
  - Step 1 "Profile": name (required to advance), email, phone
  - Step 2 "Work & Pay": default hourly rate, ABN
  - Step 3 "Invoicing": bank name, BSB, account number
  - Completed steps show a tick; "Skip for now" link available on every step
  - Only shown to workers (`role = user`) who have no name set and haven't previously completed onboarding; existing users are unaffected
  - `components/OnboardingWizard.tsx` — new self-contained wizard component
  - `hooks/useAppData.ts` — `showOnboarding` flag + `handleCompleteOnboarding` (merges wizard fields into settings and sets `onboardingCompleted: true`)
  - `types/index.ts` — `onboardingCompleted?: boolean` added to `Settings`

---

## [0.5.31] - 2026-05-17

### Added
- **Admin CSV export** — "Export CSV" button in the admin Dashboard Users summary card downloads a single file containing two sections: a per-worker summary (hours, TFN/ABN/OT split, earnings) and a full detailed entries list; filename includes the active period dates
  - `components/Dashboard.tsx` — `downloadAdminCSV` helper builds and triggers the download client-side (no API); `periodStart` / `periodEnd` added as optional props
  - `components/WorkHoursTracker.tsx` — passes `periodStart` and `periodEnd` to `Dashboard`

---

## [0.5.30] - 2026-05-17

### Added
- **GST registration toggle** — contractors registered for GST can now enable it in Settings → Personal; ABN invoices (live and saved) will display a GST (10%) line and the correct GST-inclusive total
  - `components/SettingsPage.tsx` — "Registered for GST" checkbox in the Personal tab below the ABN field
  - `components/ABNInvoice.tsx` — computes `gst = subtotal × 0.1` when `gstRegistered`; invoice shows Subtotal / GST / Total; label reads "GST (N/A)" when not registered
  - `components/InvoiceHistory.tsx` — saved invoice viewer applies the same logic using the snapshot settings; invoice list row also shows the GST-inclusive total
  - `types/index.ts` — `gstRegistered?: boolean` added to `Settings`

---

## [0.5.29] - 2026-05-17

### Added
- **Earnings trend chart** — plain-SVG bar chart on the Dashboard showing earnings grouped by week or month; no external library added
  - Worker view: stacked bars with TFN (green) at the bottom and ABN (blue) on top, with a legend; compact value labels above each bar
  - Admin view: single-colour bars showing combined team earnings per period
  - Weekly / Monthly toggle in the chart header; chart scrolls horizontally when there are many bars
  - `components/EarningsChart.tsx` — new self-contained chart component; receives `processed: ProcessedEntry[]` and `isAdmin?: boolean`
  - `components/Dashboard.tsx` — chart rendered after the metrics grids in both worker and admin layouts

---

## [0.5.28] - 2026-05-17

### Added
- **In-app logging reminder** — a dismissable banner appears between the tab bar and main content when the user hasn't logged hours for a configurable number of days; includes a "Log now" shortcut that navigates directly to the Log Entry tab
  - `hooks/useAppData.ts` — `showReminder` / `reminderDaysSince` computed via `useMemo`; `dismissReminder` callback; `reminderDismissed` per-session state
  - `components/WorkHoursTracker.tsx` — reminder banner rendered between nav and main content; only shown to non-admin users
  - `components/SettingsPage.tsx` — "Logging reminder" control in the Personal tab: enable/disable toggle + configurable day threshold (default 2 days)
  - `types/index.ts` — `reminderEnabled?: boolean` and `reminderDays?: number` added to `Settings`

---

## [0.5.27] - 2026-05-17

### Fixed
- `TFNReport.tsx` — Client column now appears when any TFN entry has a client tag; shows `—` for entries without one
- `ABNInvoice.tsx` — client name rendered as a sub-line below the job description in each invoice row
- `InvoiceHistory.tsx` — same client sub-line shown in saved invoice viewers (applies to invoices advanced from this version onward)
- `hooks/useAppData.ts` — `advanceInvoice` now includes `client` on each saved `InvLineRow` so the history viewer can display it
- `types/index.ts` — `InvLineRow` gains `client?: string`

---

## [0.5.26] - 2026-05-17

### Added
- **Entry templates** — save common work entries as reusable one-click templates
  - `LogEntry.tsx` — "Quick fill" chip bar above the form when templates exist; clicking a chip prefills job description, client, rate, and start/end times; "Save as template" secondary button captures the current form fields
  - `SettingsPage.tsx` — "Saved templates" list at the bottom of the Personal tab showing all templates with delete buttons; deletions are persisted on "Save Settings"
  - `hooks/useAppData.ts` — `handleSaveTemplate` callback stores templates inside the existing `settings` JSONB column (no DB migration required)
  - `types/index.ts` — `EntryTemplate` interface added; `templates?: EntryTemplate[]` added to `Settings`

---

## [0.5.25] - 2026-05-17

### Added
- **Client / Project tagging** — every entry can now be tagged with an optional client or project name
  - `LogEntry.tsx` — new "Client / Project (optional)" input with `datalist` autocomplete from previously used client names
  - `AdminEditModal.tsx` — same field added to the admin edit overlay
  - `EntriesList.tsx` — Client column (shown only when at least one entry has a client); client filter dropdown alongside the existing user filter; filter combines additively with user filter
  - `WeeklyReport.tsx` — client name shown as a sub-line (with building icon) below the job description in expanded day rows
  - `hooks/useAppData.ts` — `clients` list derived via `useMemo` and threaded through to all relevant components
  - `services/entries.ts` — `client` field round-tripped through `rowToEntry` / `entryToRow`
  - `types/index.ts` — `client?: string` added to `Entry`; `client: string` added to `FormState`
  - `supabase/migrations/011_entries_client.sql` — `client text` column added to the `entries` table

---

## [0.5.24] - 2026-05-16

### Fixed
- `components/ABNInvoice.tsx` — `addItem()` now shows a specific inline error message (with `ti-alert-circle` icon) when a field is invalid instead of silently doing nothing; errors clear automatically when the user edits any field
- `addItem()` validation bug fixed: negative amounts previously passed the `!amt` check; replaced with `isNaN(amt) || amt <= 0`

---

## [0.5.23] - 2026-05-16

### Fixed
- `components/EntriesList.tsx` — delete button now disables itself and swaps to a loader icon (`ti-loader-2`) while the async delete is in-flight, preventing double-clicks; button restores on completion or error via `try/finally`
- `app/globals.css` — added `.icon-btn-sm:disabled` rule (`opacity: 0.45; cursor: not-allowed; pointer-events: none`)

---

## [0.5.22] - 2026-05-16

### Changed
- `services/entries.ts` — `deleteEntry` now soft-deletes by setting `deleted_at = now()` instead of issuing a hard `DELETE`; `getEntries` and `getAdminEntries` filter `deleted_at IS NULL` so deleted rows are never returned to the UI
- `supabase/migrations/010_entries_soft_delete.sql` — adds `deleted_at timestamptz` column; replaces the plain `entries_user_id_date_idx` from migration 009 with a partial index `entries_active_user_date_idx (user_id, date, start_time) WHERE deleted_at IS NULL`, which indexes only live rows

---

## [0.5.21] - 2026-05-16

### Performance
- `components/Dashboard.tsx` — `byDate`/`dates` grouping and `userStats` aggregation are now wrapped in `useMemo` keyed on `[processed]` (and `[processed, users, isAdmin]` for the admin table); previously both loops re-ran on every render even when `settings` or `totals` changed but `processed` had not. `userStats` was also hoisted above the early-return branch to comply with the Rules of Hooks.

---

## [0.5.20] - 2026-05-16

### Performance
- `supabase/migrations/009_indexes.sql` — three composite indexes:
  - `entries(user_id, date, start_time)` — covers both `getEntries` (single user) and `getAdminEntries` (IN list) which filter by `user_id` and sort by `date`/`start_time`
  - `invoices(user_id, invoice_num DESC)` — covers `getInvoices` filter + descending sort in one index scan
  - `profiles(admin_id, role)` — covers `getManagedTeam`, `getManagedUsers`, and `getManagedAdmins` which filter `admin_id = X AND role = 'user'|'admin'`

---

## [0.5.19] - 2026-05-16

### Performance
- `services/invoices.ts` — `getInvoices` now applies `.limit(50)` so the query returns at most the 50 most recent invoices (sorted by `invoice_num` descending); previously the query was unbounded and would return every invoice ever saved

---

## [0.5.18] - 2026-05-16

### Performance
- `hooks/useAppData.ts` — wrapped all handler and helper functions with `useCallback`: `showToast`, `saveEntry`, `removeEntry`, `saveSettings`, `signOut`, `toggleTheme`, `updatePeriod`, `handleSave`, `handleEdit`, `handleAdminSave`, `handleAdminClose` (new — extracted from inline JSX), `handleDelete`, `handleSettingsSave`, `handleSaveWorkerRules`, `handleInvite`, `advanceInvoice`, `handleCancelEdit`, `handleDeleteInvoice`, `updateInvoiceItems` (extracted from return object). Stable callback references let the `React.memo` wrappers from v0.5.17 actually skip re-renders — previously every render produced new function references that defeated memo equality checks
- `components/WorkHoursTracker.tsx` — replaced the inline `() => setAdminEditEntry(null)` on `AdminEditModal.onClose` with the stable `handleAdminClose` callback

---

## [0.5.17] - 2026-05-16

### Performance
- Wrapped all tab-panel components and `ui.tsx` primitives with `React.memo`: `Dashboard`, `LogEntry`, `EntriesList`, `WeeklyReport`, `TFNReport`, `ABNInvoice`, `InvoiceHistory`, `AdminEditModal`, `SettingsPage`, `Metric`, `Bdg` — components now bail out of re-rendering when their props have not changed (e.g., when a toast appears/disappears or the admin modal opens while the active tab's data is unchanged)

---

## [0.5.16] - 2026-05-16

### Performance
- `hooks/useAppData.ts` admin init — replaced two sequential calls (`getManagedUsers` then `getManagedAdmins`, each triggering a separate `resolveRootAdminId` round-trip) with a single `getManagedTeam` call; `getManagedTeam` resolves the root admin ID once and fetches workers and co-admins in parallel. `getSettings` runs concurrently in the same batch, cutting admin startup from 3 sequential round-trips to 2.

---

## [0.5.15] - 2026-05-16

### Fixed
- `components/AdminEditModal.tsx` — `breakMins` clamped to `Math.max(0, ...)` so negative values cannot reach the calculation engine or DB; `hourlyRate` is now validated with `isNaN` + `< 0` guard before `onSave` is called, consistent with the same fix applied to `handleSave` in v0.5.11

---

## [0.5.14] - 2026-05-16

### Fixed
- `handleDeleteInvoice` in `hooks/useAppData.ts` — DB result is now checked before updating UI state; a failed delete no longer silently removes the invoice from the list and shows a success toast

---

## [0.5.13] - 2026-05-16

### Security
- `supabase/migrations/008_profiles_email_unique.sql` — added a partial unique index on `profiles.email` (where email is not null); previously the same address could be invited multiple times, creating duplicate or orphaned auth users

---

## [0.5.12] - 2026-05-16

### Security
- `app/api/invite/route.ts` — email address is now trimmed and lowercased before being passed to `inviteUserByEmail`; trailing spaces or mixed-case addresses previously created duplicate accounts

---

## [0.5.11] - 2026-05-16

### Fixed
- `handleSave` in `hooks/useAppData.ts` — `hourlyRate` is now parsed and validated before building the entry: non-numeric strings (e.g. "abc") that previously passed the truthy check and stored NaN to the DB now show an error toast instead; `breakMins` is clamped to `Math.max(0, ...)` so negative values from a crafted request cannot reach the calculation engine

---

## [0.5.10] - 2026-05-16

### Fixed
- `handleSave` in `hooks/useAppData.ts` — DB write is now awaited before updating UI state and showing a success toast; silently-failed saves no longer mark an entry as saved on screen
- `handleAdminSave` in `hooks/useAppData.ts` — same fix: the modal now stays open and shows an error toast if the DB upsert fails, instead of closing and toasting success unconditionally
- `handleDelete` in `hooks/useAppData.ts` — entry is only removed from UI state after the DB delete confirms success; previously the list updated immediately and the error (if any) was invisible

### Security
- `supabase/migrations/007_profiles_managed_select.sql` — replaced the hardcoded `admin_id = auth.uid()` check on `profiles_managed_select` with `manages_user(user_id)`, so sub-admins can now read the profiles of workers they manage (the entries/settings policies already used `manages_user`; the profiles policy was the only one left behind)
- `app/auth/confirm/route.ts` — closed open-redirect: the `?next=` query param is now validated to be a relative path before use; absolute URLs, protocol-relative URLs (`//attacker.com`), and `javascript:` URIs all fall back to `/`

---

## [0.5.6] - 2026-05-16

### Security
- `genId()` in `lib/formatters.ts` now uses `crypto.randomUUID()` instead of `Date.now().toString(36) + Math.random()` — UUIDs are cryptographically random and unguessable, whereas the old scheme was predictable from wall-clock time
- Added HTTP security headers in `next.config.ts` applied to all routes: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation off)

---

## [0.5.5] - 2026-05-16

### Performance
- Derived values (`processed`, `weeklyData`, `totals`, `tfnPct`, `allPeriodEntries`) in `hooks/useAppData.ts` are now wrapped in `useMemo` keyed on `[entries, periodStart, periodEnd, settings.tfnLimit, settings.tfnRate, settings.overtimeThreshold]` — `processEntries` no longer re-runs on every form keystroke or `editId` change
- `TABS` array is now memoised on `[userRole]` — the tab definition object is stable across renders
- Supabase client moved from a bare `createClient()` call (re-executed on every render) to `useRef(createClient())` — the client is now created once per mount

---

## [0.5.4] - 2026-05-16

### Security
- `upsertEntry` in `services/entries.ts` now always writes to the explicitly passed `userId` — previously it fell back to `entry.ownerId`, allowing the call site to silently route writes to any user's row
- `handleAdminSave` in `hooks/useAppData.ts` now explicitly passes `updated.ownerId` as the target user ID when saving an admin-edited entry, making the intent clear at the call site rather than relying on a hidden fallback in the service layer

---

## [0.5.3] - 2026-05-16

### Security
- Enabled RLS on the `settings` table and added user-ownership policies (`settings_own_select/insert/update/delete`) — without these, any authenticated user could read or modify any other user's settings (`supabase/migrations/003_settings_invoices_rls.sql`)
- Enabled RLS on the `invoices` table and added user-ownership policies (`invoices_own_select/insert/update/delete`) — without these, any authenticated user could read or delete any other user's invoice history

---

## [0.5.2] - 2026-05-16

### Security
- Added explicit user-level RLS policies on the `entries` table (`entries_own_select`, `entries_own_insert`, `entries_own_update`, `entries_own_delete`) — the previous migration referenced these policies without defining them (`supabase/migrations/002_entries_rls.sql`)

---

## [0.5.1] - 2026-05-14

### Changed
- Removed unused default Next.js SVGs from `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`)
- Rewrote `CLAUDE.md` to reflect the current architecture (hooks, services, split components, proxy middleware, user roles)

---

## [0.5.0] - 2026-05-14

### Security
- Added `proxy.ts` (Next.js 16 middleware) — unauthenticated requests are now redirected to `/login` server-side before any client JS runs, eliminating the loading-screen flash for unauthenticated users
- Added `lib/supabase-server.ts` — server-side Supabase client using `next/headers` cookies, ready for Server Components and Route Handlers

---

## [0.4.0] - 2026-05-13

### Changed (internal refactor — no user-facing changes)
- Extracted all TypeScript interfaces to `types/index.ts`
- Extracted calculation engine (`calcHours`, `processEntries`, `MIN_HOURS`) to `lib/calculations.ts`
- Extracted display helpers (`fh`, `fc`, `fd`, `fdInv`, `todayStr`, `genId`, `buildPdfFilename`, `downloadPdf`) to `lib/formatters.ts`
- Extracted all Supabase queries to `services/` (`entries.ts`, `settings.ts`, `profiles.ts`, `invoices.ts`)
- Extracted all app state, effects, and handlers to `hooks/useAppData.ts`
- Split `components/WorkHoursTracker.tsx` (1 818 lines) into 10 focused component files: `Dashboard`, `LogEntry`, `EntriesList`, `WeeklyReport`, `TFNReport`, `ABNInvoice`, `InvoiceHistory`, `AdminEditModal`, `SettingsPage`, `ui` (Metric + Bdg)
- `WorkHoursTracker.tsx` reduced to a 120-line pure rendering shell

---

## [0.3.0] - 2026-05-12

### Added
- Admin role system: admins see a combined view of all managed workers' entries; workers are linked to an admin via `admin_id` in the `profiles` table
- `supabase/migrations/001_admin.sql` — `profiles` table, security-definer helpers (`is_admin`, `manages_user`), RLS policies for profiles and admin entry access, signup trigger, back-fill for existing users
- Admin dashboard: users summary table (hours + earnings per worker) and recent-days breakdown
- `AdminEditModal` — overlay form allowing admins to edit any managed worker's entry
- Entries tab user filter for admin view
- Admin-specific tab set (no Log Entry, TFN Report, or ABN Invoice tabs)

---

## [0.2.0] - 2026-05-12

### Fixed
- All entry lists (Dashboard, Entries, ABN Invoice) now sort by date then start time
- Weekly report now shows all entries across all weeks, not just the current week
- Weekly report TFN/ABN hours and earnings were incorrect when archived entries had consumed part of the TFN budget — fixed by merging active-entry processed values over the all-entries baseline (`weeklyData` merge pattern)
- ABN invoice line items now sort by date then start time

---

## [0.1.0] - 2026-05-12

### Added
- Initial project: Next.js 16, Supabase Auth, Tailwind CSS
- Work entry logging (date, job description, start/end time, hourly rate, break minutes)
- Calculation engine: TFN/ABN split with configurable hour limit, overtime at ×1.5 above configurable daily threshold, 4-hour minimum call
- Dashboard with metrics grid (total hours, TFN/ABN hours, overtime, earnings)
- Entries list with edit and delete
- Weekly report with expandable per-entry rows and PDF download
- TFN timesheet report (printable)
- ABN tax invoice with extra line-item manager and PDF download
- Invoice history with saved invoice viewer and PDF re-download
- Settings (personal info, company info, work rules, payment details, PDF filename pattern)
- Light/dark theme toggle with system preference detection
- Supabase-backed persistence (entries, settings, invoices tables)
- Login page via Supabase Auth UI
