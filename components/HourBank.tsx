import React from "react";
import type { ProcessedEntry, Settings } from "@/types";
import { fh, fd, todayStr } from "@/lib/formatters";
import { weekStart } from "@/lib/calculations";
import { Metric, Bdg } from "./ui";

function weekLabel(monStr: string): string {
  const mon = new Date(monStr + "T12:00:00");
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;
}

interface BankWeek {
  weekStart: string;
  entries: ProcessedEntry[];
  worked: number;
  paidHours: number;
  banked: number;
  balance: number;
}

// allProcessed: every entry the worker has ever logged, so the balance is a
// running all-time total rather than a per-period figure.
export const HourBank = React.memo(function HourBank({ allProcessed, periodProcessed, settings, periodStart, periodEnd }: {
  allProcessed: ProcessedEntry[];
  periodProcessed: ProcessedEntry[];
  settings: Settings;
  periodStart: string;
  periodEnd: string;
}) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const { weeks, balance, thisWeek } = React.useMemo(() => {
    const weekMap = new Map<string, ProcessedEntry[]>();
    for (const e of allProcessed) {
      const ws = weekStart(e.date);
      if (!weekMap.has(ws)) weekMap.set(ws, []);
      weekMap.get(ws)!.push(e);
    }

    let running = 0;
    const weeks: BankWeek[] = [...weekMap.keys()].sort().map(ws => {
      const entries = weekMap.get(ws)!;
      const worked    = entries.reduce((a, e) => a + e.total,      0);
      const paidHours = entries.reduce((a, e) => a + e.tfnPortion, 0);
      const banked    = entries.reduce((a, e) => a + e.bankHours,  0);
      running += banked;
      return { weekStart: ws, entries, worked, paidHours, banked, balance: running };
    });

    const currentWeek = weeks.find(w => w.weekStart === weekStart(todayStr()));
    return { weeks, balance: running, thisWeek: currentWeek?.banked ?? 0 };
  }, [allProcessed]);

  const periodBanked = React.useMemo(
    () => periodProcessed.reduce((a, e) => a + e.bankHours, 0),
    [periodProcessed],
  );

  const banking = weeks.filter(w => w.banked > 0);

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
        <Metric label="This week"        value={fh(thisWeek)}     sub="banked since Monday"                      color="info" />
        <Metric label="Weekly threshold" value={fh(settings.tfnLimit)} sub="hours paid before banking starts"    />
      </div>

      {banking.length === 0 ? (
        <div className="empty-state mt-4">
          <i className="ti ti-clock-dollar" aria-hidden="true" style={{ fontSize: 36, color: "var(--color-text-tertiary)" }} />
          <p>No hours banked yet</p>
          <p className="muted" style={{ fontSize: 12 }}>
            Hours above your {fh(settings.tfnLimit)} weekly limit are added to your bank.
          </p>
        </div>
      ) : (
        <div className="card mt-3" style={{ overflowX: "auto" }}>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
            Statement by week — balance carries forward
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Week</th>
                <th>Entries</th>
                <th>Worked</th>
                <th>Paid hrs</th>
                <th>Banked</th>
                <th>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {weeks.map(w => (
                <React.Fragment key={w.weekStart}>
                  <tr>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{weekLabel(w.weekStart)}</td>
                    <td>{w.entries.length}</td>
                    <td className="mono">{fh(w.worked)}</td>
                    <td className="mono">{w.paidHours > 0 ? <Bdg type="tfn">{fh(w.paidHours)}</Bdg> : <span className="muted">—</span>}</td>
                    <td className="mono">{w.banked > 0 ? <Bdg type="bank">+{fh(w.banked)}</Bdg> : <span className="muted">—</span>}</td>
                    <td className="mono" style={{ fontWeight: 500 }}>{fh(w.balance)}</td>
                    <td>
                      <button
                        className="icon-btn-sm no-print"
                        onClick={() => setExpanded(prev => ({ ...prev, [w.weekStart]: !prev[w.weekStart] }))}
                        aria-label={expanded[w.weekStart] ? "Collapse" : "Expand"}
                      >
                        <i className={`ti ${expanded[w.weekStart] ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>

                  {expanded[w.weekStart] && [...w.entries]
                    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime))
                    .map(e => (
                      <tr key={e.id} style={{ background: "var(--color-background-secondary)" }}>
                        <td className="mono muted" style={{ fontSize: 11, paddingLeft: 24 }}>{fd(e.date)}</td>
                        <td colSpan={2} style={{ fontSize: 12 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{e.jobDescription}</div>
                          <div className="mono muted" style={{ fontSize: 11, marginTop: 2 }}>
                            {e.startTime}–{e.endTime}
                            {e.breakMins > 0 && <span> −{e.breakMins}m</span>}
                          </div>
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>{e.tfnPortion > 0 ? fh(e.tfnPortion) : <span className="muted">—</span>}</td>
                        <td>{e.bankHours > 0 ? <Bdg type="bank">+{fh(e.bankHours)}</Bdg> : <span className="muted">—</span>}</td>
                        <td colSpan={2} />
                      </tr>
                    ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid var(--color-border-secondary)" }}>
                <td style={{ fontWeight: 500, fontSize: 12 }}>Balance</td>
                <td colSpan={4} />
                <td className="mono" style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-bank)" }}>{fh(balance)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
});
