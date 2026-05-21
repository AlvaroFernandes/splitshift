import React, { useMemo } from "react";
import type { ManagedUser, ProcessedEntry, Settings, Totals } from "@/types";
import { fh, fc, fd } from "@/lib/formatters";
import { Metric, Bdg } from "./ui";
import { EarningsChart } from "./EarningsChart";

function csvEsc(v: string | number): string {
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadAdminCSV(
  processed: ProcessedEntry[],
  users: ManagedUser[],
  periodStart: string,
  periodEnd: string,
) {
  const byUser = new Map<string, ProcessedEntry[]>();
  for (const e of processed) {
    const uid = e.ownerId ?? "";
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(e);
  }
  const workerMap = new Map(users.map(u => [u.id, u]));

  const rows: string[] = [];
  const period = `${periodStart || "All time"} to ${periodEnd || "All time"}`;

  // — Summary section —
  rows.push(`HourSplit — Admin Export`);
  rows.push(`Period,${period}`);
  rows.push(``);
  rows.push(`WORKER SUMMARY`);
  rows.push([
    "Name", "Email", "Entries",
    "Total Hrs", "TFN Hrs", "ABN Hrs", "OT Hrs",
    "TFN Earnings (AUD)", "ABN Earnings (AUD)", "Total Earnings (AUD)",
  ].map(csvEsc).join(","));

  for (const u of users) {
    const ue = byUser.get(u.id) ?? [];
    if (ue.length === 0) continue;
    rows.push([
      u.name, u.email, ue.length,
      ue.reduce((a, e) => a + e.total,        0).toFixed(2),
      ue.reduce((a, e) => a + e.tfnPortion,   0).toFixed(2),
      ue.reduce((a, e) => a + e.abnPortion,   0).toFixed(2),
      ue.reduce((a, e) => a + e.overtime,     0).toFixed(2),
      ue.reduce((a, e) => a + e.tfnEarnings,  0).toFixed(2),
      ue.reduce((a, e) => a + e.abnEarnings,  0).toFixed(2),
      ue.reduce((a, e) => a + e.totalEarnings,0).toFixed(2),
    ].map(csvEsc).join(","));
  }

  // — Detailed entries section —
  rows.push(``);
  rows.push(`DETAILED ENTRIES`);
  rows.push([
    "Date", "Worker", "Job Description", "Client",
    "Start", "End", "Break (min)", "Hours", "Rate (AUD/h)",
    "TFN Hrs", "ABN Hrs", "OT Hrs",
    "TFN Earnings", "ABN Earnings", "Total Earnings",
  ].map(csvEsc).join(","));

  const sorted = [...processed].sort((a, b) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  );
  for (const e of sorted) {
    const workerName = workerMap.get(e.ownerId ?? "")?.name ?? "Unknown";
    rows.push([
      e.date, workerName, e.jobDescription, e.client ?? "",
      e.startTime, e.endTime, e.breakMins, e.total.toFixed(2), e.hourlyRate.toFixed(2),
      e.tfnPortion.toFixed(2), e.abnPortion.toFixed(2), e.overtime.toFixed(2),
      e.tfnEarnings.toFixed(2), e.abnEarnings.toFixed(2), e.totalEarnings.toFixed(2),
    ].map(csvEsc).join(","));
  }

  const blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `hoursplit-${(periodStart || "all").replace(/-/g, "")}-${(periodEnd || "all").replace(/-/g, "")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const Dashboard = React.memo(function Dashboard({ totals, tfnPct, settings, processed, chartProcessed, isAdmin, users, periodStart, periodEnd }: {
  totals: Totals; tfnPct: number; settings: Settings; processed: ProcessedEntry[]; chartProcessed: ProcessedEntry[];
  isAdmin?: boolean; users?: ManagedUser[];
  periodStart?: string; periodEnd?: string;
}) {
  const { byDate, dates } = useMemo(() => {
    const byDate: Record<string, ProcessedEntry[]> = {};
    for (const e of processed) { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); }
    return { byDate, dates: Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 10) };
  }, [processed]);

  const userMap = useMemo(() => new Map((users ?? []).map(u => [u.id, u.name])), [users]);

  const userStats = useMemo(() => {
    if (!isAdmin || !users) return [];
    const byUser = new Map<string, { entries: number; hours: number; earnings: number }>();
    for (const e of processed) {
      const uid = e.ownerId ?? "";
      const cur = byUser.get(uid) ?? { entries: 0, hours: 0, earnings: 0 };
      byUser.set(uid, { entries: cur.entries + 1, hours: cur.hours + e.total, earnings: cur.earnings + e.totalEarnings });
    }
    return users
      .map(u => ({ ...u, ...(byUser.get(u.id) ?? { entries: 0, hours: 0, earnings: 0 }) }))
      .sort((a, b) => b.hours - a.hours);
  }, [processed, users, isAdmin]);

  if (isAdmin && users) {
    return (
      <div>
        <h2 className="sr-only">Admin dashboard</h2>
        <div className="metric-grid">
          <Metric label="Total hours"    value={fh(totals.hours)}      sub={`${processed.length} entries`} />
          <Metric label="Total earnings" value={fc(totals.total)}       bold />
          <Metric label="Users"          value={String(users.length)}  sub="managed" />
        </div>

        <EarningsChart processed={chartProcessed} isAdmin />

        {userStats.length > 0 && (
          <div className="card mt-4" style={{ overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>Users summary</p>
              <button
                className="btn-secondary"
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => downloadAdminCSV(processed, users, periodStart ?? "", periodEnd ?? "")}
              >
                <i className="ti ti-download" aria-hidden="true" /> Export CSV
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>User</th><th>Entries</th><th>Hours</th><th>Earnings</th></tr>
              </thead>
              <tbody>
                {userStats.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{u.email}</div>
                    </td>
                    <td>{u.entries}</td>
                    <td className="mono">{fh(u.hours)}</td>
                    <td className="mono">{fc(u.earnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {dates.length > 0 && (
          <div className="card mt-4" style={{ overflowX: "auto" }}>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>Recent days</p>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>User</th><th>Jobs</th><th>Hours</th><th>Earnings</th></tr>
              </thead>
              <tbody>
                {dates.map(date => {
                  const de = byDate[date];
                  return de.map((e, i) => (
                    <tr key={e.id}>
                      {i === 0 && <td className="mono" style={{ fontSize: 12 }} rowSpan={de.length}>{fd(date)}</td>}
                      <td style={{ fontSize: 12 }}>{userMap.get(e.ownerId ?? "") ?? "—"}</td>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{e.jobDescription}</td>
                      <td className="mono">{fh(e.total)}</td>
                      <td className="mono">{fc(e.totalEarnings)}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="sr-only">Dashboard overview</h2>

      <div className="metric-grid">
        <Metric label="Total hours"  value={fh(totals.hours)}    sub={`${processed.length} entries`}    />
        <Metric label="TFN hours"    value={fh(totals.tfnHours)} sub={`of ${settings.tfnLimit}h limit`} color="success" progress={tfnPct} />
        {settings.excessMode === "bank"
          ? <Metric label="Hour bank"  value={fh(totals.bankHours)} sub="accrued, not invoiced" color="info" />
          : <Metric label="ABN hours"  value={fh(totals.abnHours)}  sub="invoiceable excess"    color="info" />
        }
        <Metric label="Overtime"     value={fh(totals.otHours)}  sub="×1.5 rate applied"               color="warning" />
      </div>
      <div className="metric-grid mt-3">
        <Metric label="TFN earnings"   value={fc(totals.tfnEarnings)} color="success" />
        {settings.excessMode !== "bank" && (
          <Metric label="ABN earnings" value={fc(totals.abnEarnings)} color="info" />
        )}
        <Metric label="Total earnings" value={fc(totals.total)}       bold />
      </div>

      <EarningsChart processed={chartProcessed} />

      {dates.length > 0 ? (
        <div className="card mt-4">
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>Recent days</p>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Jobs</th><th>Hours</th>
                  <th>Overtime</th><th>TFN</th>
                  <th>{settings.excessMode === "bank" ? "Bank" : "ABN"}</th>
                  <th>Earnings</th>
                </tr>
              </thead>
              <tbody>
                {dates.map(date => {
                  const de = byDate[date];
                  const d = de.reduce((a, e) => ({
                    h:    a.h    + e.total,
                    ot:   a.ot   + e.overtime,
                    tfn:  a.tfn  + e.tfnPortion,
                    abn:  a.abn  + (settings.excessMode === "bank" ? e.bankHours : e.abnPortion),
                    earn: a.earn + e.totalEarnings,
                  }), { h:0, ot:0, tfn:0, abn:0, earn:0 });
                  const abnType = settings.excessMode === "bank" ? "bank" : "abn";
                  return (
                    <tr key={date}>
                      <td className="mono" style={{ fontSize: 12 }}>{fd(date)}</td>
                      <td>{de.length}</td>
                      <td className="mono">{fh(d.h)}</td>
                      <td>{d.ot  > 0 ? <Bdg type="ot">{fh(d.ot)}</Bdg>       : <span className="muted">—</span>}</td>
                      <td>{d.tfn > 0 ? <Bdg type="tfn">{fh(d.tfn)}</Bdg>     : <span className="muted">—</span>}</td>
                      <td>{d.abn > 0 ? <Bdg type={abnType}>{fh(d.abn)}</Bdg> : <span className="muted">—</span>}</td>
                      <td className="mono">{fc(d.earn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state mt-4">
          <i className="ti ti-clock" aria-hidden="true" style={{ fontSize: 36, color: "var(--color-text-tertiary)" }} />
          <p>No entries in this period</p>
          <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
            Set a period in the header, then log your first job
          </p>
        </div>
      )}
    </div>
  );
});
