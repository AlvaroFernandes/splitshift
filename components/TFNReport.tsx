import React from "react";
import type { ProcessedEntry, Totals, Settings } from "@/types";
import { fh, fc, fd } from "@/lib/formatters";
import { weekStart } from "@/lib/calculations";

function weekLabel(monStr: string): string {
  const mon = new Date(monStr + "T12:00:00");
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;
}

export const TFNReport = React.memo(function TFNReport({ processed, totals, settings, periodStart, periodEnd }: {
  processed: ProcessedEntry[]; totals: Totals; settings: Settings;
  periodStart: string; periodEnd: string;
}) {
  const tfnEntries = processed.filter(e => e.tfnPortion > 0);
  const regHrs     = tfnEntries.reduce((a, e) => a + e.rTFN,  0);
  const otHrs      = tfnEntries.reduce((a, e) => a + e.otTFN, 0);
  const hasClients = tfnEntries.some(e => e.client);

  // Group TFN entries by Mon–Sun week
  const weekMap = new Map<string, ProcessedEntry[]>();
  for (const e of tfnEntries) {
    const ws = weekStart(e.date);
    if (!weekMap.has(ws)) weekMap.set(ws, []);
    weekMap.get(ws)!.push(e);
  }
  const weeks = [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <h2 className="sr-only">TFN timesheet report</h2>

      <div className="print-actions no-print">
        <button className="btn-secondary" onClick={() => window.print()}>
          <i className="ti ti-printer" aria-hidden="true" /> Print / Save PDF
        </button>
      </div>

      <div className="card report-header">
        <div>
          <div className="report-label tfn">TFN Timesheet</div>
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

      {tfnEntries.length === 0 ? (
        <div className="empty-state mt-4"><p>No TFN hours in this period</p></div>
      ) : (
        <>
          {weeks.map(([ws, entries]) => {
            const wRegHrs = entries.reduce((a, e) => a + e.rTFN,  0);
            const wOtHrs  = entries.reduce((a, e) => a + e.otTFN, 0);
            const wEarnings = entries.reduce((a, e) => a + e.tfnEarnings, 0);

            return (
              <div key={ws} className="card mt-3" style={{ overflowX: "auto" }}>
                <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    Week: {weekLabel(ws)}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--color-text-success)" }}>
                    {fc(wEarnings)}
                  </span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Job description</th>
                      {hasClients && <th>Client</th>}
                      <th>Start</th><th>End</th>
                      <th>Regular hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.id}>
                        <td className="mono" style={{ fontSize: 12 }}>{fd(e.date)}</td>
                        <td>{e.jobDescription}</td>
                        {hasClients && <td style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{e.client ?? <span className="muted">—</span>}</td>}
                        <td className="mono">{e.startTime}</td>
                        <td className="mono">{e.endTime}</td>
                        <td className="mono">
                          {fh(e.rTFN)}
                          {e.otTFN > 0 && (
                            <span style={{ marginLeft: 4, color: "var(--color-text-tertiary)", fontSize: 11 }}>
                              ({fh(e.rTFN + e.otTFN * 1.5)})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "1px solid var(--color-border-secondary)" }}>
                      <td colSpan={hasClients ? 5 : 4} style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        Week total
                      </td>
                      <td className="mono" style={{ fontWeight: 500 }}>
                        {fh(wRegHrs)}
                        {wOtHrs > 0 && (
                          <span style={{ marginLeft: 4, color: "var(--color-text-tertiary)", fontSize: 11 }}>
                            ({fh(wRegHrs + wOtHrs * 1.5)})
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          <div className="totals-row mt-3">
            <div className="card" style={{ padding: "12px 16px" }}>
              <div className="muted" style={{ fontSize: 12 }}>Regular hours</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-success)" }}>
                {fh(regHrs)}
                {otHrs > 0 && (
                  <span style={{ marginLeft: 6, color: "var(--color-text-tertiary)", fontSize: 13, fontWeight: 400 }}>
                    ({fh(regHrs + otHrs * 1.5)})
                  </span>
                )}
              </div>
            </div>
            <div className="card" style={{ padding: "12px 16px" }}>
              <div className="muted" style={{ fontSize: 12 }}>Overtime hours</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-warning)" }}>{fh(otHrs)}</div>
            </div>
            <div className="card" style={{ padding: "12px 16px" }}>
              <div className="muted" style={{ fontSize: 12 }}>TFN total</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-success)" }}>{fc(totals.tfnEarnings)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
