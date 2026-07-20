"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type {
  AuditEntry, Entry, EntryTemplate, ManagedUser, ProcessedEntry, Settings, Totals,
  FormState, Toast, InvLineRow, SavedInvoice, UserRole,
} from "@/types";
import { calcHours, processEntries, weekStart } from "@/lib/calculations";
import { todayStr, genId } from "@/lib/formatters";
import { getEntries, upsertEntry, deleteEntry, archiveEntries, unarchiveEntries } from "@/services/entries";
import { DEFAULT_SETTINGS, getWorkerSettings, saveWorkerSettings as saveWorkerSettingsSvc } from "@/services/settings";

// Rebuilds the ABN invoice line items derived from work entries (rate/hours-based
// rows), given a week's worth of processed entries. Manual/extra rows on a saved
// invoice have no entryId and are left untouched by recomputation.
function buildEntryRows(processedWeek: ProcessedEntry[]): InvLineRow[] {
  const rows: InvLineRow[] = [];
  for (const e of processedWeek) {
    if (e.abnPortion <= 0) continue;
    if (e.rABN > 0)  rows.push({ key: e.id + "-r",  entryId: e.id, date: e.date, startTime: e.startTime, description: e.jobDescription,                     client: e.client, rate: e.hourlyRate,       hours: e.rABN,  amount: e.rABN  * e.hourlyRate       });
    if (e.otABN > 0) rows.push({ key: e.id + "-ot", entryId: e.id, date: e.date, startTime: e.startTime, description: `${e.jobDescription} (overtime ×1.5)`, client: e.client, rate: e.hourlyRate * 1.5, hours: e.otABN, amount: e.otABN * e.hourlyRate * 1.5 });
  }
  return rows;
}

async function fetchSettings(): Promise<{ settings: import("@/types").Settings; periodStart: string; periodEnd: string } | null> {
  const res = await fetch("/api/settings");
  if (!res.ok) return null;
  return res.json();
}

async function persistSettings(settings: import("@/types").Settings, periodStart: string, periodEnd: string): Promise<boolean> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings, periodStart, periodEnd }),
  });
  return res.ok;
}
import { ensureProfile, getProfile, getManagedUsers, getManagedAdmins, getManagedTeam } from "@/services/profiles";
import { getInvoices, saveInvoice, updateInvoice, deleteInvoice, generateShareToken } from "@/services/invoices";
import { logActivity, getAuditLog } from "@/services/audit";

export function useAppData() {
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;
  const router      = useRouter();

  const [tab,             setTab]             = useState("dashboard");
  const [entries,         setEntries]         = useState<Entry[]>([]);
  const [settings,        setSettings]        = useState<Settings>(DEFAULT_SETTINGS);
  const [periodStart,     setPeriodStart]     = useState("");
  const [periodEnd,       setPeriodEnd]       = useState("");
  const [toast,           setToast]           = useState<Toast | null>(null);
  const [editId,          setEditId]          = useState<string | null>(null);
  const [theme,           setTheme]           = useState<"light" | "dark">("light");
  const [userId,          setUserId]          = useState<string | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [invoiceHistory,  setInvoiceHistory]  = useState<SavedInvoice[]>([]);
  const [viewingInvoice,  setViewingInvoice]  = useState<SavedInvoice | null>(null);
  const [userRole,        setUserRole]        = useState<UserRole>("user");
  const [managedUsers,    setManagedUsers]    = useState<ManagedUser[]>([]);
  const [managedAdmins,   setManagedAdmins]   = useState<ManagedUser[]>([]);
  const [managedViewers,  setManagedViewers]  = useState<ManagedUser[]>([]);
  const [adminEditEntry,  setAdminEditEntry]  = useState<Entry | null>(null);
  const [adminUserFilter, setAdminUserFilter] = useState<string>("all");
  const [workerSettings,     setWorkerSettings]     = useState<Record<string, Settings>>({});
  const [reminderDismissed,  setReminderDismissed]  = useState(false);
  const [auditLog,           setAuditLog]           = useState<AuditEntry[]>([]);
  const [adminCompanyInfo,   setAdminCompanyInfo]   = useState<{ companyName: string; companyAbn: string; companyAddress: string; companyEmail: string } | null>(null);

  // Refs for stale-closure-safe reads inside memoised callbacks
  const entriesRef        = useRef<Entry[]>([]);
  const managedUsersRef   = useRef<ManagedUser[]>([]);
  const userIdRef         = useRef<string | null>(null);
  const toastTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef       = useRef<Settings>(DEFAULT_SETTINGS);
  const invoiceHistoryRef = useRef<SavedInvoice[]>([]);
  useEffect(() => { entriesRef.current        = entries;        }, [entries]);
  useEffect(() => { managedUsersRef.current   = managedUsers;   }, [managedUsers]);
  useEffect(() => { userIdRef.current         = userId;         }, [userId]);
  useEffect(() => { settingsRef.current       = settings;       }, [settings]);
  useEffect(() => { invoiceHistoryRef.current = invoiceHistory; }, [invoiceHistory]);

  useEffect(() => {
    const saved = localStorage.getItem("wh_theme") as "light" | "dark" | null;
    const initial = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("wh_theme", next);
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        const invited = await ensureProfile(supabase, user.id, user.email);
        if (!invited) {
          await supabase.auth.signOut();
          router.push("/login?error=not_invited");
          return;
        }

        const { role, adminId } = await getProfile(supabase, user.id);
        setUserRole(role);

        if (role === "admin") {
          const [team, settingsRow, log, entriesRes] = await Promise.all([
            getManagedTeam(supabase, user.id),
            fetchSettings(),
            getAuditLog(supabase),
            fetch("/api/admin-entries"),
          ]);
          setManagedUsers(team.users);
          setManagedAdmins(team.admins);
          setManagedViewers(team.viewers);
          setAuditLog(log);

          const fetchedEntries = entriesRes.ok ? await entriesRes.json() : [];
          const workerIds = team.users.map(u => u.id);
          const fetchedWorkerSettings = await getWorkerSettings(supabase, workerIds);
          setEntries(fetchedEntries);
          setWorkerSettings(fetchedWorkerSettings);
          if (settingsRow) {
            setSettings(settingsRow.settings);
            if (settingsRow.periodStart) setPeriodStart(settingsRow.periodStart);
            if (settingsRow.periodEnd)   setPeriodEnd(settingsRow.periodEnd);
          }
        } else if (role === "viewer") {
          if (!adminId) { setLoading(false); return; }
          const [team, settingsRow, entriesRes] = await Promise.all([
            getManagedTeam(supabase, adminId),
            fetchSettings(),
            fetch("/api/admin-entries"),
          ]);
          setManagedUsers(team.users);

          const fetchedEntries = entriesRes.ok ? await entriesRes.json() : [];
          const workerIds = team.users.map(u => u.id);
          const fetchedWorkerSettings = await getWorkerSettings(supabase, workerIds);
          setEntries(fetchedEntries);
          setWorkerSettings(fetchedWorkerSettings);
          if (settingsRow) {
            setSettings(settingsRow.settings);
            if (settingsRow.periodStart) setPeriodStart(settingsRow.periodStart);
            if (settingsRow.periodEnd)   setPeriodEnd(settingsRow.periodEnd);
          }
        } else {
          const [fetchedEntries, settingsRow, invoices, companyRes] = await Promise.all([
            getEntries(supabase, user.id),
            fetchSettings(),
            getInvoices(supabase, user.id),
            fetch("/api/company-info"),
          ]);
          if (companyRes.ok) setAdminCompanyInfo(await companyRes.json());
          setEntries(fetchedEntries);
          if (settingsRow) {
            setSettings(settingsRow.settings);
            if (settingsRow.periodStart) setPeriodStart(settingsRow.periodStart);
            if (settingsRow.periodEnd)   setPeriodEnd(settingsRow.periodEnd);
          }
          setInvoiceHistory(invoices);
        }

        setLoading(false);
      } catch (err) {
        console.error("[init] failed to load app data:", err);
        showToast("Failed to load your data. Please refresh the page.", "err");
        setLoading(false);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the issue date current: stamp today if unset or if stored date is in the past
  useEffect(() => {
    if (!loading && userId) {
      const today = todayStr();
      if (!settings.invoiceDate || settings.invoiceDate < today) {
        const s = { ...settings, invoiceDate: today };
        setSettings(s);
        saveSettings(s, periodStart, periodEnd);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId]);

  // setToast is a stable setter — no deps needed
  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // supabase is stable (useRef) — omitted from deps intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveEntry = useCallback(async (entry: Entry, uid: string): Promise<boolean> => {
    return upsertEntry(supabase, entry, uid);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const removeEntry = useCallback(async (id: string): Promise<boolean> => {
    return deleteEntry(supabase, id);
  }, []);

  // supabase stable (useRef) — omitted from deps intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveSettings = useCallback(async (s: Settings, ps: string, pe: string) => {
    const ok = await persistSettings(s, ps, pe);
    if (!ok) showToast("Could not save settings", "err");
  }, [showToast]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, []);

  const updatePeriod = useCallback((field: "start" | "end", val: string) => {
    const ps = field === "start" ? val : periodStart;
    const pe = field === "end"   ? val : periodEnd;
    if (field === "start") setPeriodStart(ps); else setPeriodEnd(pe);
    if (userId) saveSettings(settings, ps, pe);
  }, [periodStart, periodEnd, userId, settings]); // saveSettings is stable

  const clearPeriod = useCallback(() => {
    setPeriodStart("");
    setPeriodEnd("");
    if (userId) saveSettings(settings, "", "");
  }, [userId, settings]); // saveSettings/setters are stable

  // Recomputes and persists the saved invoice covering `entryDate`, if any, from
  // the current entry data. Lets a worker correct hours/rate on an already-
  // invoiced week without having to delete and recreate the invoice by hand.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recomputeInvoiceForEntry = useCallback((allEntries: Entry[], entryDate: string) => {
    const inv = invoiceHistoryRef.current.find(i =>
      entryDate >= i.data.periodStart && entryDate <= i.data.periodEnd,
    );
    if (!inv) return;

    const s = settingsRef.current;
    const weekEntries = allEntries.filter(e =>
      e.archived && e.date >= inv.data.periodStart && e.date <= inv.data.periodEnd,
    );
    const tfnRateParsed = parseFloat(s.tfnRate || "") || undefined;
    const processedWeek = processEntries(weekEntries, s.tfnLimit, tfnRateParsed, s.overtimeThreshold || 12, s.excessMode ?? "abn");

    const entryRows = buildEntryRows(processedWeek);
    const manualRows = inv.data.rows.filter(r => !r.entryId);
    const rows = [...entryRows, ...manualRows].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });
    const subtotal = rows.reduce((sum, r) => sum + r.amount, 0);
    const updated: SavedInvoice = { ...inv, subtotal, data: { ...inv.data, rows } };

    updateInvoice(supabase, {
      id: updated.id, issueDate: updated.issueDate, companyName: updated.companyName,
      subtotal: updated.subtotal, data: updated.data,
    }).then(ok => {
      if (!ok) { showToast("Entry saved, but the invoice could not be updated", "err"); return; }
      setInvoiceHistory(prev => prev.map(i => i.id === updated.id ? updated : i));
      setViewingInvoice(prev => (prev && prev.id === updated.id) ? updated : prev);
      showToast(`Invoice #${updated.invoiceNum} recalculated`);
    });
  }, []); // supabase/showToast/setters/refs are stable

  const handleSave = useCallback(async (formData: FormState): Promise<boolean> => {
    const { date, jobDescription, startTime, endTime, hourlyRate } = formData;
    if (!date || !jobDescription.trim() || !startTime || !endTime || !hourlyRate) {
      showToast("All fields are required", "err"); return false;
    }
    const hourlyRateNum = parseFloat(hourlyRate);
    if (isNaN(hourlyRateNum) || hourlyRateNum < 0) {
      showToast("Hourly rate must be a valid positive number", "err"); return false;
    }
    const breakMinsNum = Math.max(0, parseInt(formData.breakMins || "0") || 0);
    if (calcHours(startTime, endTime) <= 0) {
      showToast("End time must be after start time", "err"); return false;
    }
    const original = editId ? entries.find(e => e.id === editId) : null;
    const entry: Entry = {
      ...formData,
      hourlyRate: hourlyRateNum,
      breakMins:  breakMinsNum,
      id: editId || genId(),
      ...(original?.archived && { archived: true }),
      ...(original?.ownerId  && { ownerId: original.ownerId }),
    };
    if (userId) {
      const ok = await saveEntry(entry, userId);
      if (!ok) { showToast("Could not save entry", "err"); return false; }
    }
    const newEntries = editId
      ? entries.map(e => e.id === editId ? entry : e)
      : [...entries, entry];
    setEntries(newEntries);
    showToast(editId ? "Entry updated" : "Entry added");
    if (!editId) {
      // Fire-and-forget — never blocks the UI or fails the save
      fetch("/api/notify-entry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date:           entry.date,
          jobDescription: entry.jobDescription,
          client:         entry.client,
          startTime:      entry.startTime,
          endTime:        entry.endTime,
          breakMins:      entry.breakMins,
          hourlyRate:     entry.hourlyRate,
        }),
      }).catch(() => {});
    }
    if (original?.archived) recomputeInvoiceForEntry(newEntries, entry.date);
    setEditId(null);
    return true;
  }, [editId, userId, entries]); // formData is a param; showToast/saveEntry/setters/recomputeInvoiceForEntry are stable

  const handleEdit = useCallback((entry: ProcessedEntry) => {
    if (userRole === "admin") {
      setAdminEditEntry(entry);
    } else {
      setEditId(entry.id);
      setTab("log");
    }
  }, [userRole]); // setters are stable

  // Fire-and-forget: optimistically prepend to local log, persist in background
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recordAudit = useCallback((action: string, targetType: string | null, targetId: string | null, meta: Record<string, unknown>) => {
    const uid = userIdRef.current;
    if (!uid) return;
    const entry: AuditEntry = { id: genId(), adminId: uid, actorId: uid, action, targetType, targetId, meta, createdAt: new Date().toISOString() };
    setAuditLog(prev => [entry, ...prev]);
    logActivity(supabase, uid, uid, action, targetType, targetId, meta);
  }, []); // supabase/setters/refs are stable

  const handleAdminSave = useCallback(async (updated: Entry) => {
    if (!userId) return;
    const ok = await saveEntry(updated, updated.ownerId ?? userId);
    if (!ok) { showToast("Could not save entry", "err"); return; }
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    setAdminEditEntry(null);
    showToast("Entry updated");
    const workerName = managedUsersRef.current.find(u => u.id === updated.ownerId)?.name ?? "worker";
    recordAudit("entry_edited", "entry", updated.id, { workerName, entryDate: updated.date, jobDescription: updated.jobDescription });
  }, [userId]); // saveEntry/showToast/setters/refs/recordAudit are stable

  const handleAdminClose = useCallback(() => setAdminEditEntry(null), []); // setAdminEditEntry is stable

  const handleDelete = useCallback(async (id: string) => {
    const entry = entriesRef.current.find(e => e.id === id);
    const ok = await removeEntry(id);
    if (!ok) { showToast("Could not delete entry", "err"); return; }
    const remaining = entriesRef.current.filter(e => e.id !== id);
    setEntries(remaining);
    showToast("Entry deleted");
    if (entry?.ownerId) {
      const workerName = managedUsersRef.current.find(u => u.id === entry.ownerId)?.name ?? "worker";
      recordAudit("entry_deleted", "entry", id, { workerName, entryDate: entry.date, jobDescription: entry.jobDescription });
    }
    if (entry?.archived) recomputeInvoiceForEntry(remaining, entry.date);
  }, []); // removeEntry/showToast/setters/refs/recordAudit/recomputeInvoiceForEntry are stable

  const handleSettingsSave = useCallback((s: Settings) => {
    setSettings(s);
    if (userId) saveSettings(s, periodStart, periodEnd);
    showToast("Settings saved");
  }, [userId, periodStart, periodEnd]); // saveSettings/showToast/setSettings are stable

  const handleSaveWorkerRules = useCallback(async (
    rules: { userId: string; tfnLimit: number; overtimeThreshold: number; excessMode: "abn" | "bank" }[],
  ) => {
    const results = await Promise.all(
      rules.map(({ userId: wid, tfnLimit, overtimeThreshold, excessMode }) => {
        const existing = workerSettings[wid] ?? DEFAULT_SETTINGS;
        const updated  = { ...existing, tfnLimit, overtimeThreshold, excessMode };
        setWorkerSettings(prev => ({ ...prev, [wid]: updated }));
        return saveWorkerSettingsSvc(supabase, wid, updated);
      })
    );
    if (results.some(ok => !ok)) showToast("Could not save some worker rules", "err");
    else {
      showToast("Worker rules saved");
      recordAudit("worker_rules_saved", null, null, { workerCount: rules.length });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerSettings]); // supabase/showToast/setters/recordAudit are stable

  // ── Derived values ─────────────────────────────────────────────────────────
  // Memoised so processEntries (sort + multi-pass accumulation) only re-runs
  // when entries or the relevant settings actually change, not on every form
  // keystroke or editId update.

  const { allPeriodEntries, processed, weeklyData, totals, tfnPct, chartProcessed } = useMemo(() => {
    const allPeriodEntries = entries.filter(e =>
      (!periodStart || e.date >= periodStart) &&
      (!periodEnd   || e.date <= periodEnd)
    );
    const periodEntries = allPeriodEntries.filter(e => !e.archived);

    let processed: ReturnType<typeof processEntries>;
    let allProcessed: ReturnType<typeof processEntries>;

    if (userRole === "admin") {
      // Process each worker's entries independently so their own tfnLimit,
      // tfnRate, and overtimeThreshold are respected rather than the admin's.
      const workerIds = [...new Set(allPeriodEntries.map(e => e.ownerId).filter(Boolean))] as string[];
      const procParts: ReturnType<typeof processEntries> = [];
      const allProcParts: ReturnType<typeof processEntries> = [];
      for (const uid of workerIds) {
        const ws  = workerSettings[uid] ?? DEFAULT_SETTINGS;
        const tfnRateParsed = parseFloat(ws.tfnRate || "") || undefined;
        const ot  = ws.overtimeThreshold || 12;
        const lim = ws.tfnLimit || 30;
        const em = ws.excessMode ?? "abn";
        procParts.push(   ...processEntries(periodEntries.filter(e => e.ownerId === uid),    lim, tfnRateParsed, ot, em));
        allProcParts.push(...processEntries(allPeriodEntries.filter(e => e.ownerId === uid), lim, tfnRateParsed, ot, em));
      }
      processed   = procParts;
      allProcessed = allProcParts;
    } else {
      const tfnRateParsed = parseFloat(settings.tfnRate || "") || undefined;
      const em = settings.excessMode ?? "abn";
      processed    = processEntries(periodEntries,    settings.tfnLimit, tfnRateParsed, settings.overtimeThreshold || 12, em);
      allProcessed = processEntries(allPeriodEntries, settings.tfnLimit, tfnRateParsed, settings.overtimeThreshold || 12, em);
    }

    // Earnings chart: all entries across all time (no period filter, including archived)
    let chartProcessed: ReturnType<typeof processEntries>;
    if (userRole === "admin") {
      const allWorkerIds = [...new Set(entries.map(e => e.ownerId).filter(Boolean))] as string[];
      const chartParts: ReturnType<typeof processEntries> = [];
      for (const uid of allWorkerIds) {
        const ws = workerSettings[uid] ?? DEFAULT_SETTINGS;
        const tfnRateParsed = parseFloat(ws.tfnRate || "") || undefined;
        chartParts.push(...processEntries(entries.filter(e => e.ownerId === uid), ws.tfnLimit || 30, tfnRateParsed, ws.overtimeThreshold || 12, ws.excessMode ?? "abn"));
      }
      chartProcessed = chartParts;
    } else {
      const tfnRateParsed = parseFloat(settings.tfnRate || "") || undefined;
      chartProcessed = processEntries(entries, settings.tfnLimit, tfnRateParsed, settings.overtimeThreshold || 12, settings.excessMode ?? "abn");
    }

    // Weekly report: all entries visible, but active entries use current-period TFN/ABN budget
    const processedById = new Map(processed.map(e => [e.id, e]));
    const weeklyData    = allProcessed.map(e => processedById.get(e.id) ?? e);
    const totals        = processed.reduce<Totals>((a, e) => ({
      hours:       a.hours       + e.total,
      tfnHours:    a.tfnHours    + e.tfnPortion,
      abnHours:    a.abnHours    + e.abnPortion,
      bankHours:   a.bankHours   + e.bankHours,
      otHours:     a.otHours     + e.overtime,
      tfnEarnings: a.tfnEarnings + e.tfnEarnings,
      abnEarnings: a.abnEarnings + e.abnEarnings,
      total:       a.total       + e.totalEarnings,
    }), { hours: 0, tfnHours: 0, abnHours: 0, bankHours: 0, otHours: 0, tfnEarnings: 0, abnEarnings: 0, total: 0 });
    // tfnPct: current week's TFN progress (period-independent, for the dashboard meter)
    let tfnPct = 0;
    if (userRole === "user") {
      const today   = todayStr();
      const mon     = weekStart(today);
      const tfnRateW = parseFloat(settings.tfnRate || "") || undefined;
      const weekProc = processEntries(
        entries.filter(e => !e.archived && e.date >= mon && e.date <= today),
        settings.tfnLimit, tfnRateW, settings.overtimeThreshold || 12, settings.excessMode ?? "abn",
      );
      // Use weighted hours (OT = 1.5×) to match how the TFN budget is consumed
      const weekWeightedTfn = weekProc.reduce((s, e) => s + e.rTFN + e.otTFN * 1.5, 0);
      tfnPct = Math.min(100, (weekWeightedTfn / (settings.tfnLimit || 30)) * 100);
    }
    return { allPeriodEntries, processed, weeklyData, totals, tfnPct, chartProcessed };
  }, [entries, periodStart, periodEnd, settings.tfnLimit, settings.tfnRate, settings.overtimeThreshold, settings.excessMode, userRole, workerSettings]);

  const editEntry = useMemo(
    () => (editId ? (entries.find(e => e.id === editId) ?? null) : null),
    [editId, entries],
  );

  // Already-invoiced entries a worker can still correct; editing/deleting one
  // triggers recomputeInvoiceForEntry to keep the saved invoice in sync.
  const archivedEntries = useMemo(
    () => (userRole === "user" ? weeklyData.filter(e => e.archived) : []),
    [weeklyData, userRole],
  );

  const TABS = useMemo(() => {
    if (userRole === "admin") return [
      { id: "dashboard", label: "Dashboard",    icon: "ti-layout-dashboard" },
      { id: "entries",   label: "Entries",      icon: "ti-list"             },
      { id: "weekly",    label: "Weekly Report", icon: "ti-calendar-week"   },
      { id: "activity",  label: "Activity",     icon: "ti-activity"         },
    ];
    if (userRole === "viewer") return [
      { id: "dashboard", label: "Dashboard",    icon: "ti-layout-dashboard" },
      { id: "entries",   label: "Entries",      icon: "ti-list"             },
      { id: "weekly",    label: "Weekly Report", icon: "ti-calendar-week"   },
    ];
    const isBank = settings.excessMode === "bank";
    return [
      { id: "dashboard", label: "Dashboard",    icon: "ti-layout-dashboard" },
      { id: "log",       label: "Log Entry",    icon: "ti-clock-plus"       },
      { id: "entries",   label: "Entries",      icon: "ti-list"             },
      { id: "weekly",    label: "Weekly Report", icon: "ti-calendar-week"   },
      { id: "tfn",       label: "TFN Report",   icon: "ti-report"           },
      ...(!isBank ? [
        { id: "abn",     label: "ABN Invoice",  icon: "ti-receipt"          },
        { id: "history", label: "Invoices",     icon: "ti-history"          },
      ] : []),
    ];
  }, [userRole, settings.excessMode]);

  const clients = useMemo(() =>
    [...new Set(entries.map(e => e.client).filter(Boolean))].sort() as string[],
  [entries]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleInvite = useCallback(async (email: string, role: "user" | "admin" | "viewer", name?: string) => {
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, name }),
    });
    const json = await res.json();
    if (!res.ok) { showToast(json.error ?? "Could not send invitation", "err"); return; }
    showToast(`Invitation sent to ${email}`);
    recordAudit("invite_sent", null, null, { email, role });
    if (role === "admin") {
      const admins = await getManagedAdmins(supabase, userId!);
      setManagedAdmins(admins);
    } else if (role === "viewer") {
      const viewers = await supabase.from("profiles").select("user_id, name, email").eq("admin_id", userId!).eq("role", "viewer");
      setManagedViewers((viewers.data ?? []).map((p: Record<string, unknown>) => ({
        id: p.user_id as string, name: (p.name as string) || (p.email as string) || "Unknown", email: (p.email as string) || "",
      })));
    } else {
      const users = await getManagedUsers(supabase, userId!);
      setManagedUsers(users);
    }
  }, [userId]); // supabase/showToast/setters are stable

  // ── Invoice advance ────────────────────────────────────────────────────────

  const advanceInvoice = useCallback(async () => {
    const extraItems = settings.invoiceItems || [];
    const abnEntries = processed.filter(e => e.abnPortion > 0);
    if (abnEntries.length === 0) return;

    // Invoice only the oldest uninvoiced week — one invoice per click
    const oldestWeek = [...new Set(abnEntries.map(e => weekStart(e.date)))].sort()[0];
    const wkEntries  = abnEntries.filter(e => weekStart(e.date) === oldestWeek);

    const rows: InvLineRow[] = buildEntryRows(wkEntries);
    for (const item of extraItems) rows.push({ key: item.id, date: item.date, description: item.description, rate: null, hours: null, amount: item.amount });
    rows.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });

    const wkAbn    = wkEntries.reduce((s, e) => s + e.abnEarnings, 0);
    const subtotal = wkAbn + extraItems.reduce((s, it) => s + it.amount, 0);

    const wkSunDate = new Date(oldestWeek + "T12:00:00");
    wkSunDate.setDate(wkSunDate.getDate() + 6);
    const wkSun = wkSunDate.toISOString().slice(0, 10);

    let saved: SavedInvoice | null = null;
    if (userId) {
      saved = await saveInvoice(supabase, {
        id: genId(), userId,
        invoiceNum:  settings.invoiceNum || 1,
        issueDate:   settings.invoiceDate || todayStr(),
        companyName: settings.companyName || "",
        subtotal,
        settings: { ...settings, invoiceItems: extraItems },
        rows,
        periodStart: oldestWeek,
        periodEnd:   wkSun,
      });
      if (!saved) { showToast("Could not save invoice history", "err"); return; }
    }

    // Archive all entries from this week (TFN + ABN) now that the week is invoiced.
    // If archiving fails, roll back the just-saved invoice to prevent double-invoicing.
    const toArchiveIds = allPeriodEntries
      .filter(e => !e.archived && weekStart(e.date) === oldestWeek)
      .map(e => e.id);
    if (toArchiveIds.length > 0 && userId) {
      const ok = await archiveEntries(supabase, toArchiveIds);
      if (!ok) {
        if (saved) await deleteInvoice(supabase, saved.id);
        showToast("Could not archive entries — invoice was not saved", "err");
        return;
      }
      setEntries(prev => prev.map(e => toArchiveIds.includes(e.id) ? { ...e, archived: true } : e));
    }

    if (saved) setInvoiceHistory(prev => [saved!, ...prev]);

    const s = { ...settings, invoiceNum: (settings.invoiceNum || 1) + 1, invoiceDate: todayStr(), invoiceItems: [] };
    setSettings(s);
    if (userId) saveSettings(s, periodStart, periodEnd);
    showToast(`Invoice #${settings.invoiceNum} saved`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, processed, allPeriodEntries, userId, periodStart, periodEnd]); // supabase/showToast/setters stable

  // Closes a week that never exceeded the TFN limit (no ABN/bank excess), so it
  // drops out of the active period without going through the invoice flow.
  const closeWeek = useCallback(async (ws: string) => {
    const weekEntries = weeklyData.filter(e => weekStart(e.date) === ws);
    const exceeded = weekEntries.some(e => e.abnPortion > 0 || e.bankHours > 0);
    if (exceeded) { showToast("This week has hours over the limit — invoice required", "err"); return; }

    const toCloseIds = weekEntries.filter(e => !e.archived).map(e => e.id);
    if (toCloseIds.length === 0) return;

    if (userId) {
      const ok = await archiveEntries(supabase, toCloseIds);
      if (!ok) { showToast("Could not close week", "err"); return; }
    }
    setEntries(prev => prev.map(e => toCloseIds.includes(e.id) ? { ...e, archived: true } : e));
    showToast("Week closed — no invoice needed");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyData, userId]); // supabase/showToast/setters stable

  const handleCancelEdit = useCallback(() => {
    setEditId(null);
  }, []); // all stable setters

  const dismissReminder = useCallback(() => setReminderDismissed(true), []);

  const handleCompleteOnboarding = useCallback((partial: Partial<Settings>) => {
    const s = { ...settings, ...partial, onboardingCompleted: true };
    setSettings(s);
    if (userId) saveSettings(s, periodStart, periodEnd);
  }, [settings, userId, periodStart, periodEnd]); // saveSettings/setSettings are stable

  const { showReminder, reminderDaysSince } = useMemo(() => {
    if (userRole === "admin" || userRole === "viewer" || settings.reminderEnabled === false || loading) {
      return { showReminder: false, reminderDaysSince: 0 };
    }
    const threshold = settings.reminderDays ?? 2;
    const today     = todayStr();
    const lastDate  = entries
      .filter(e => !e.archived)
      .map(e => e.date)
      .sort()
      .at(-1) ?? null;
    const daysSince = lastDate
      ? Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / 86_400_000)
      : Infinity;
    return { showReminder: daysSince >= threshold, reminderDaysSince: isFinite(daysSince) ? daysSince : -1 };
  }, [entries, settings.reminderEnabled, settings.reminderDays, userRole, loading]);

  const handleSaveTemplate = useCallback((formData: FormState) => {
    if (!formData.jobDescription.trim()) { showToast("Add a job description first", "err"); return; }
    const template: EntryTemplate = {
      id: genId(),
      jobDescription: formData.jobDescription.trim(),
      ...(formData.client.trim()  && { client:    formData.client.trim()  }),
      ...(formData.hourlyRate     && { hourlyRate: formData.hourlyRate     }),
      ...(formData.startTime      && { startTime:  formData.startTime      }),
      ...(formData.endTime        && { endTime:    formData.endTime        }),
    };
    const s = { ...settings, templates: [...(settings.templates ?? []), template] };
    setSettings(s);
    if (userId) saveSettings(s, periodStart, periodEnd);
    showToast("Template saved");
  }, [settings, userId, periodStart, periodEnd]); // formData is a param; showToast/saveSettings/setSettings are stable

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleShareInvoice = useCallback(async (id: string) => {
    const existing = invoiceHistory.find(i => i.id === id);
    let token = existing?.shareToken;
    if (!token) {
      const t = await generateShareToken(supabase, id);
      if (!t) { showToast("Could not generate share link", "err"); return; }
      token = t;
      setInvoiceHistory(prev => prev.map(i => i.id === id ? { ...i, shareToken: token } : i));
    }
    const url = `${window.location.origin}/invoice/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied!");
    } catch {
      showToast(`Share link: ${url}`);
    }
  }, [invoiceHistory]); // supabase/showToast/setters stable

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleDeleteInvoice = useCallback(async (id: string) => {
    const inv = invoiceHistoryRef.current.find(i => i.id === id);
    const ok = await deleteInvoice(supabase, id);
    if (!ok) { showToast("Could not delete invoice", "err"); return; }
    setInvoiceHistory(prev => prev.filter(i => i.id !== id));
    if (viewingInvoice?.id === id) setViewingInvoice(null);

    // Deleting the invoice shouldn't leave its entries stuck as archived —
    // that would hide them from ABN Invoice generation with no way to re-invoice them.
    if (inv) {
      const toRestore = entriesRef.current
        .filter(e => e.archived && e.date >= inv.data.periodStart && e.date <= inv.data.periodEnd)
        .map(e => e.id);
      if (toRestore.length > 0 && await unarchiveEntries(supabase, toRestore)) {
        setEntries(prev => prev.map(e => toRestore.includes(e.id) ? { ...e, archived: false } : e));
      }
    }
    showToast("Invoice deleted");
  }, [viewingInvoice]); // supabase/showToast/setters/refs are stable

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleUpdateInvoice = useCallback(async (updated: SavedInvoice) => {
    const ok = await updateInvoice(supabase, {
      id:          updated.id,
      issueDate:   updated.issueDate,
      companyName: updated.companyName,
      subtotal:    updated.subtotal,
      data:        updated.data,
    });
    if (!ok) { showToast("Could not update invoice", "err"); return; }
    setInvoiceHistory(prev => prev.map(i => i.id === updated.id ? updated : i));
    setViewingInvoice(updated);
    showToast("Invoice updated");
  }, []); // supabase/showToast/setters are stable

  const updateInvoiceItems = useCallback((items: Settings["invoiceItems"]) => {
    const s = { ...settings, invoiceItems: items };
    setSettings(s);
    if (userId) saveSettings(s, periodStart, periodEnd);
  }, [settings, userId, periodStart, periodEnd]); // saveSettings/setSettings are stable

  return {
    // state
    tab, setTab,
    settings, setSettings,
    periodStart, periodEnd,
    editEntry,
    toast,
    theme,
    loading,
    invoiceHistory,
    viewingInvoice, setViewingInvoice,
    userRole,
    managedUsers,
    adminEditEntry, setAdminEditEntry,
    adminUserFilter, setAdminUserFilter,
    // derived
    processed, weeklyData, totals, tfnPct, chartProcessed, TABS, archivedEntries,
    // handlers
    toggleTheme, signOut, updatePeriod, clearPeriod,
    handleSave, handleEdit, handleAdminSave, handleAdminClose,
    handleDelete, handleSettingsSave, handleSaveWorkerRules, handleInvite,
    workerSettings, managedAdmins, clients,
    advanceInvoice, closeWeek, handleDeleteInvoice, handleShareInvoice, handleUpdateInvoice, handleCancelEdit,
    updateInvoiceItems, handleSaveTemplate,
    showReminder, reminderDaysSince, dismissReminder, reminderDismissed,
    showOnboarding: !loading && !settings.onboardingCompleted &&
      ((userRole === "user" && !settings.yourName) || userRole === "admin"),
    managedViewers,
    handleCompleteOnboarding,
    auditLog,
    adminCompanyInfo,
  };
}
