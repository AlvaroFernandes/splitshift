import React, { useMemo } from "react";
import type { ProcessedEntry, SavedInvoice, Settings } from "@/types";
import type { BankClosure } from "@/services/bankClosures";
import { fh, fc, todayStr } from "@/lib/formatters";
import { weekStart, weekEnd } from "@/lib/calculations";
import { nextPayday, payday, payFortnight } from "@/lib/payroll";
import { estimateNetForPeriod } from "@/lib/tax";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime()) / 86_400_000);
}

// Compact hours for the day strip: "8h", "8h30".
function shortHours(h: number): string {
  const mins = Math.round(h * 60);
  const m = mins % 60;
  return `${Math.floor(mins / 60)}h${m ? String(m).padStart(2, "0") : ""}`;
}

// "28 Sep"
function shortDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

interface TodoItem { key: string; icon: string; text: string; action: string; tab: string; }

// Worker's "at a glance" panel at the top of the Dashboard: where this week
// stands against their TFN limit, the next payday, what needs doing, and the
// rules their admin set. Works off all-time processed entries (each week
// under its own frozen regime), independent of the header's period filter.
export const WorkerOverview = React.memo(function WorkerOverview({ processed, settings, bankClosures, invoiceHistory, onNavigate }: {
  processed: ProcessedEntry[];
  settings: Settings;
  bankClosures: BankClosure[];
  invoiceHistory: SavedInvoice[];
  onNavigate: (tab: string) => void;
}) {
  const isBank   = settings.excessMode === "bank";
  const tfnLimit = settings.tfnLimit || 30;
  const today    = todayStr();

  // ── This week ───────────────────────────────────────────────────────────────
  const week = useMemo(() => {
    const ws = weekStart(today);
    const entries = processed.filter(e => weekStart(e.date) === ws);
    const byDay = DAY_LABELS.map((_, i) => {
      const date = addDays(ws, i);
      return { date, hours: entries.filter(e => e.date === date).reduce((a, e) => a + e.total, 0) };
    });
    const used  = entries.reduce((a, e) => a + e.rTFN + e.otTFN * 1.5, 0);
    const extra = entries.reduce((a, e) => a + e.abnPortion, 0);
    const hours = entries.reduce((a, e) => a + e.total, 0);
    return { ws, byDay, used, extra, hours };
  }, [processed, today]);

  const pct      = Math.min(100, (week.used / tfnLimit) * 100);
  const left     = Math.max(0, tfnLimit - week.used);
  const extraDst = isBank ? "your Hour Bank" : "your ABN invoice";

  // ── Next payday ─────────────────────────────────────────────────────────────
  const pay = useMemo(() => {
    const date = nextPayday(today);
    const covers = payFortnight(date);
    const entries = processed.filter(e => payday(e.date) === date);
    const tfn = entries.reduce((a, e) => a + e.tfnEarnings, 0);
    const abn = entries.reduce((a, e) => a + e.abnEarnings, 0);
    return { date, covers, tfn, abn, tfnNet: estimateNetForPeriod(tfn, 26).net, inDays: daysBetween(today, date) };
  }, [processed, today]);

  // ── To do ───────────────────────────────────────────────────────────────────
  const todos = useMemo<TodoItem[]>(() => {
    const items: TodoItem[] = [];
    const openPastWeeks = new Map<string, boolean>(); // week start → needs an invoice
    for (const e of processed) {
      if (e.archived) continue;
      const ws = weekStart(e.date);
      if (weekEnd(ws) >= today) continue;
      openPastWeeks.set(ws, (openPastWeeks.get(ws) ?? false) || (!isBank && e.abnPortion > 0));
    }
    for (const [ws, needsInvoice] of [...openPastWeeks].sort(([a], [b]) => a.localeCompare(b))) {
      items.push(needsInvoice
        ? { key: ws, icon: "ti-receipt", text: `Invoice due for the week of ${shortDate(ws)}`, action: "Create invoice", tab: "abn" }
        : { key: ws, icon: "ti-lock-check", text: `Close the week of ${shortDate(ws)}`, action: "Close week", tab: "tfn" });
    }
    if (!settings.yourName?.trim()) {
      items.push({ key: "name", icon: "ti-user", text: "Add your name", action: "Settings", tab: "settings" });
    }
    if (!isBank && !settings.abn?.trim()) {
      items.push({ key: "abn", icon: "ti-id", text: "Add your ABN for invoices", action: "Settings", tab: "settings" });
    }
    if (!isBank && !(settings.bsb?.trim() && settings.accountNumber?.trim())) {
      items.push({ key: "bank", icon: "ti-building-bank", text: "Add bank details for invoices", action: "Settings", tab: "settings" });
    }
    return items;
  }, [processed, today, isBank, settings.yourName, settings.abn, settings.bsb, settings.accountNumber]);

  // ── Hour Bank balance / last invoice ────────────────────────────────────────
  const bankBalance = useMemo(() => {
    const closed  = bankClosures.filter(c => c.mode === "bank").reduce((a, c) => a + c.hours, 0);
    const pending = processed.filter(e => !e.archived).reduce((a, e) => a + e.bankHours, 0);
    return closed + pending;
  }, [bankClosures, processed]);

  const lastInvoice = useMemo(
    () => [...invoiceHistory].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [invoiceHistory],
  );

  const tfnRate = parseFloat(settings.tfnRate || "");

  return (
    <div className="overview">
      <div className="overview-top">
        <section className="card ov-card">
          <div className="ov-head">
            <p className="ov-title">This week</p>
            <p className="ov-meta">{shortDate(week.ws)} – {shortDate(weekEnd(week.ws))}</p>
          </div>
          <div className="ov-big">
            <span className="mono">{fh(week.hours)}</span>
            <span className="ov-big-sub">worked</span>
          </div>
          <div className="ov-progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
            aria-label="TFN limit used this week">
            <div className={`ov-progress-fill${pct >= 100 ? " full" : ""}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="ov-progress-labels">
            <span><span className="mono">{fh(week.used)}</span> of {fh(tfnLimit)} TFN limit used</span>
            <span className="mono">{Math.round(pct)}%</span>
          </div>
          <p className="ov-status">
            {pct >= 100
              ? <>Limit reached — <b>{fh(week.extra)}</b> going to {extraDst} this week.</>
              : <><b>{fh(left)}</b> left before extra hours go to {extraDst}.</>}
          </p>
          <div className="week-strip">
            {week.byDay.map((d, i) => (
              <div key={d.date} className={`day-cell${d.date === today ? " today" : ""}${d.hours > 0 ? " worked" : ""}`}>
                <span className="day-label">{DAY_LABELS[i]}</span>
                <span className="day-hours mono">{d.hours > 0 ? shortHours(d.hours) : "—"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card ov-card ov-payday">
          <div className="ov-head">
            <p className="ov-title">Next payday</p>
            <p className="ov-meta">{pay.inDays === 0 ? "Today" : pay.inDays === 1 ? "Tomorrow" : `In ${pay.inDays} days`}</p>
          </div>
          <div className="ov-big">
            <span>{new Date(pay.date + "T12:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>
          <p className="ov-meta">For work {shortDate(pay.covers.start)} – {shortDate(pay.covers.end)}</p>
          <dl className="ov-list">
            <div><dt>TFN gross</dt><dd className="mono">{fc(pay.tfn)}</dd></div>
            <div><dt>TFN take-home (est.)</dt><dd className="mono">{fc(pay.tfnNet)}</dd></div>
            {!isBank && <div><dt>ABN invoices</dt><dd className="mono">{fc(pay.abn)}</dd></div>}
          </dl>
          <p className="ov-note">Estimates from the hours logged so far for that fortnight.</p>
        </section>
      </div>

      <div className="overview-row">
        <section className="card ov-card">
          <div className="ov-head">
            <p className="ov-title">To do</p>
            {todos.length > 0 && <p className="ov-meta">{todos.length}</p>}
          </div>
          {todos.length === 0 ? (
            <p className="ov-done"><i className="ti ti-circle-check" aria-hidden="true" /> You&apos;re all caught up.</p>
          ) : (
            <ul className="todo-list">
              {todos.slice(0, 4).map(t => (
                <li key={t.key}>
                  <i className={`ti ${t.icon}`} aria-hidden="true" />
                  <span>{t.text}</span>
                  <button className="btn-secondary todo-btn" onClick={() => onNavigate(t.tab)}>{t.action}</button>
                </li>
              ))}
              {todos.length > 4 && <li className="ov-note">+{todos.length - 4} more</li>}
            </ul>
          )}
        </section>

        {isBank ? (
          <section className="card ov-card">
            <div className="ov-head"><p className="ov-title">Hour Bank balance</p></div>
            <div className="ov-big"><span className="mono" style={{ color: "var(--color-text-bank)" }}>{fh(bankBalance)}</span></div>
            <p className="ov-meta">Including this week&apos;s extra hours so far</p>
            <button className="btn-secondary todo-btn" onClick={() => onNavigate("bank")}>View statement</button>
          </section>
        ) : (
          <section className="card ov-card">
            <div className="ov-head"><p className="ov-title">Last invoice</p></div>
            {lastInvoice ? (
              <>
                <div className="ov-big"><span className="mono" style={{ color: "var(--color-text-info)" }}>{fc(lastInvoice.subtotal)}</span></div>
                <p className="ov-meta">
                  #{lastInvoice.invoiceNum} · week of {shortDate(lastInvoice.data.periodStart)}
                  {lastInvoice.companyName && ` · ${lastInvoice.companyName}`}
                </p>
                <button className="btn-secondary todo-btn" onClick={() => onNavigate("history")}>All invoices</button>
              </>
            ) : (
              <p className="ov-meta">No invoices yet. Weeks over your limit will need one.</p>
            )}
          </section>
        )}

        <section className="card ov-card">
          <div className="ov-head">
            <p className="ov-title">Your work rules</p>
            <p className="ov-meta">Set by your admin</p>
          </div>
          <dl className="ov-list">
            <div><dt>Weekly TFN limit</dt><dd className="mono">{fh(tfnLimit)}</dd></div>
            <div><dt>TFN rate</dt><dd className="mono">{isNaN(tfnRate) ? "Entry rate" : `${fc(tfnRate)}/h`}</dd></div>
            <div><dt>Overtime after</dt><dd className="mono">{fh(settings.overtimeThreshold || 12)} / shift</dd></div>
            <div><dt>Extra hours go to</dt><dd>{isBank ? "Hour Bank" : "ABN invoice"}</dd></div>
            {isBank && <div><dt>Worker type</dt><dd>{settings.workerType === "office" ? "Office" : "Site"}</dd></div>}
          </dl>
        </section>
      </div>
    </div>
  );
});
