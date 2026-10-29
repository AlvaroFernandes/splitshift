import React from "react";
import type { ProcessedEntry, Settings } from "@/types";
import type { BankClosure } from "@/services/bankClosures";
import type { BankAdjustment } from "@/services/bankAdjustments";
import { fh, fd, todayStr } from "@/lib/formatters";
import { weekStart, weekEnd, limitPeriodOf } from "@/lib/calculations";
import { Metric, Bdg } from "./ui";

function weekLabel(monStr: string): string {
  const mon = new Date(monStr + "T12:00:00");
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;
}

interface StatementRow {
  key: string;
  // Week start for accrual rows, adjustment date for adjustment rows
  date: string;
  kind: "closed" | "pending" | "adjustment";
  hours: number;
  balance: number;
  note?: string;
}

// bankClosures: permanent, frozen record of every week closed via closeWeek
// in useAppData.ts — only the Hour Bank ones count towards the balance. These never change even if the
// worker's mode is switched later, so past weeks always show their true
// history. openProcessed: this worker's currently open (not yet closed)
// entries, live-computed under their current settings — a preview of what
// would be banked once the active week is closed. adjustments: changes the
// admin made to the balance — negative when banked hours were paid out.
export const HourBank = React.memo(function HourBank({ bankClosures: allClosures, adjustments, openProcessed, settings, periodStart, periodEnd }: {
  bankClosures: BankClosure[];
  adjustments: BankAdjustment[];
  openProcessed: ProcessedEntry[];
  settings: Settings;
  periodStart: string;
  periodEnd: string;
}) {
  const bankClosures = React.useMemo(
    () => allClosures.filter(c => c.mode === "bank"),
    [allClosures],
  );

  const closedBalance = React.useMemo(
    () => bankClosures.reduce((s, c) => s + c.hours, 0),
    [bankClosures],
  );

  const { pendingByWeek, pendingTotal } = React.useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const e of openProcessed) {
      const ws = weekStart(e.date);
      byWeek.set(ws, (byWeek.get(ws) ?? 0) + e.bankHours);
    }
    const total = [...byWeek.values()].reduce((a, b) => a + b, 0);
    return { pendingByWeek: byWeek, pendingTotal: total };
  }, [openProcessed]);

  const adjustedTotal = React.useMemo(
    () => adjustments.reduce((s, a) => s + a.hours, 0),
    [adjustments],
  );
  const paidOut = React.useMemo(
    () => -adjustments.filter(a => a.hours < 0).reduce((s, a) => s + a.hours, 0),
    [adjustments],
  );

  const balance = closedBalance + adjustedTotal + pendingTotal;

  const thisWeekStart = weekStart(todayStr());
  const thisWeekPending = pendingByWeek.get(thisWeekStart) ?? 0;

  const periodClosed = React.useMemo(
    () => bankClosures
      .filter(c => (!periodStart || c.weekStart >= periodStart) && (!periodEnd || c.weekStart <= periodEnd))
      .reduce((s, c) => s + c.hours, 0),
    [bankClosures, periodStart, periodEnd],
  );
  const periodBanked = periodClosed + pendingTotal;

  const statement = React.useMemo(() => {
    // A week's accrual is only known once the week ends, so an adjustment
    // dated inside a week sorts after that week's row.
    const closed: Omit<StatementRow, "balance">[] = [
      ...bankClosures.map(c => ({ key: `w-${c.weekStart}`, date: c.weekStart, kind: "closed" as const, hours: c.hours })),
      ...adjustments.map(a => ({ key: `a-${a.id}`, date: a.date, kind: "adjustment" as const, hours: a.hours, note: a.note })),
    ].sort((a, b) =>
      (a.kind === "adjustment" ? a.date : weekEnd(a.date)).localeCompare(b.kind === "adjustment" ? b.date : weekEnd(b.date))
      || a.key.localeCompare(b.key));
    let running = 0;
    const rows: StatementRow[] = closed.map(r => {
      running += r.hours;
      return { ...r, balance: running };
    });
    for (const [ws, hours] of [...pendingByWeek.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      running += hours;
      rows.push({ key: `p-${ws}`, date: ws, kind: "pending", hours, balance: running });
    }
    return rows;
  }, [bankClosures, adjustments, pendingByWeek]);

  return (
    <div>
      <h2 className="sr-only">Hour bank</h2>

      <div className="print-actions no-print">
        <button className="btn-secondary" onClick={() => window.print()}>
          <i className="ti ti-printer" aria-hidden="true" /> Print / Save PDF
        </button>
      </div>

      <div className="card report-header">
        <div>
          <div className="report-label bank">Hour Bank</div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 500 }}>{settings.yourName || "Your Name"}</div>
            {settings.companyName && (
              <div className="muted" style={{ fontSize: 13 }}>{settings.companyName}</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: 12 }}>Period</div>
          <div className="mono">{fd(periodStart)} — {fd(periodEnd)}</div>
        </div>
      </div>

      <div className="metric-grid mt-3">
        <Metric label="Bank balance"     value={fh(balance)}      sub="accrued, all time"                        bold />
        <Metric label="This period"      value={fh(periodBanked)} sub="banked in current period"                 color="info" />
        <Metric label="This week"        value={fh(thisWeekPending)} sub="pending — week not yet closed"         color="info" />
        <Metric label="Paid out"         value={fh(paidOut)}      sub="banked hours paid by your admin"           />
      </div>

      {statement.length === 0 ? (
        <div className="empty-state mt-4">
          <i className="ti ti-clock-dollar" aria-hidden="true" style={{ fontSize: 36, color: "var(--color-text-tertiary)" }} />
          <p>No hours banked yet</p>
          <p className="muted" style={{ fontSize: 12 }}>
            Hours above your {fh(settings.tfnLimit)} {limitPeriodOf(settings) === "month" ? "monthly" : "weekly"} limit are added to your bank.
          </p>
        </div>
      ) : (
        <div className="card mt-3" style={{ overflowX: "auto" }}>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
            Statement — balance carries forward. Hours above your {fh(settings.tfnLimit)} {limitPeriodOf(settings) === "month" ? "monthly" : "weekly"} limit are banked.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Week / date</th>
                <th>Status</th>
                <th>Change</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {statement.map(row => (
                <tr key={row.key} style={row.kind === "pending" ? { opacity: 0.7 } : undefined}>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 500 }}>
                    {row.kind === "adjustment" ? fd(row.date) : weekLabel(row.date)}
                    {row.note && <div className="muted" style={{ fontSize: 11, fontWeight: 400, whiteSpace: "normal" }}>{row.note}</div>}
                  </td>
                  <td>
                    {row.kind === "pending"    && <span className="muted" style={{ fontSize: 12 }}>Pending</span>}
                    {row.kind === "closed"     && <Bdg type="bank">Closed</Bdg>}
                    {row.kind === "adjustment" && <Bdg type="mixed">{row.hours < 0 ? "Paid out" : "Adjusted"}</Bdg>}
                  </td>
                  <td className="mono">
                    {row.hours > 0 ? <Bdg type="bank">+{fh(row.hours)}</Bdg>
                      : row.hours < 0 ? <Bdg type="danger">−{fh(-row.hours)}</Bdg>
                      : <span className="muted">—</span>}
                  </td>
                  <td className="mono" style={{ fontWeight: 500 }}>{row.balance < 0 ? `−${fh(-row.balance)}` : fh(row.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid var(--color-border-secondary)" }}>
                <td style={{ fontWeight: 500, fontSize: 12 }}>Balance</td>
                <td colSpan={2} />
                <td className="mono" style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-bank)" }}>{fh(balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
});
