import React from "react";
import type { ManagedUser, ProcessedEntry, Settings } from "@/types";
import { fh, fc, fd, fdInv, downloadPdf } from "@/lib/formatters";
import { weekStart } from "@/lib/calculations";
import { Bdg } from "./ui";

function weekEnd(monStr: string): string {
  const d = new Date(monStr + "T12:00:00");
  d.setDate(d.getDate() + 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekLabel(monStr: string): string {
  const mon = new Date(monStr + "T12:00:00");
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;
}

interface WeekSummary {
  weekStart: string;
  entries: ProcessedEntry[];
  hours: number;
  breakMinsTotal: number;
  regular: number;
  overtime: number;
  tfnHours: number;
  abnHours: number;
  tfnEarnings: number;
  abnEarnings: number;
  total: number;
}

function WeekTimesheetDoc({ week, settings }: { week: WeekSummary; settings: Settings }) {
  const sorted = [...week.entries].sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime)
  );

  return (
    <div id="week-timesheet-doc" className="invoice-doc">
      <div style={{ textAlign: "right", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>TIMESHEET</h1>
        <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>{weekLabel(week.weekStart)}</div>
      </div>

      <div className="inv-header" style={{ marginBottom: 20 }}>
        <div className="inv-from">
          {settings.yourName    && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{settings.yourName}</div>}
          {settings.abn         && <div>ABN: {settings.abn}</div>}
          {settings.yourAddress && <div>{settings.yourAddress}</div>}
          {settings.yourPhone   && <div>Phone: {settings.yourPhone}</div>}
          {settings.yourEmail   && <div>Email: {settings.yourEmail}</div>}
        </div>
        <div className="inv-from">
          {settings.companyName  && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{settings.companyName}</div>}
          {settings.companyAbn   && <div>ABN: {settings.companyAbn}</div>}
          {settings.companyEmail && <div>Email: {settings.companyEmail}</div>}
        </div>
      </div>

      <table className="inv-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Start</th>
            <th>End</th>
            <th style={{ textAlign: "right" }}>Break</th>
            <th style={{ textAlign: "right" }}>Hours</th>
            <th style={{ textAlign: "right" }}>TFN hrs</th>
            <th style={{ textAlign: "right" }}>ABN hrs</th>
            <th style={{ textAlign: "right" }}>OT hrs</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(e => (
            <tr key={e.id}>
              <td style={{ whiteSpace: "nowrap" }}>{fdInv(e.date)}</td>
              <td>{e.jobDescription}</td>
              <td>{e.startTime}</td>
              <td>{e.endTime}</td>
              <td style={{ textAlign: "right", color: e.breakMins > 0 ? undefined : "#999" }}>{e.breakMins > 0 ? `${e.breakMins}m` : "—"}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{e.total.toFixed(2)}</td>
              <td style={{ textAlign: "right", color: e.tfnPortion > 0 ? "#16a34a" : "#999" }}>{e.tfnPortion > 0 ? e.tfnPortion.toFixed(2) : "—"}</td>
              <td style={{ textAlign: "right", color: e.abnPortion > 0 ? "#1d4ed8" : "#999" }}>{e.abnPortion > 0 ? e.abnPortion.toFixed(2) : "—"}</td>
              <td style={{ textAlign: "right", color: e.overtime   > 0 ? "#d97706" : "#999" }}>{e.overtime   > 0 ? e.overtime.toFixed(2)   : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-box" style={{ marginTop: 0 }}>
        <div className="inv-box-title">Hours summary</div>
        <div className="inv-totals-line"><span>Regular hours</span><span>{week.regular.toFixed(2)}</span></div>
        {week.overtime > 0 && <div className="inv-totals-line"><span>Overtime hours (×1.5)</span><span>{week.overtime.toFixed(2)}</span></div>}
        {week.tfnHours > 0 && <div className="inv-totals-line"><span style={{ color: "#16a34a" }}>TFN hours</span><span>{week.tfnHours.toFixed(2)}</span></div>}
        {week.abnHours > 0 && <div className="inv-totals-line"><span style={{ color: "#1d4ed8" }}>ABN hours</span><span>{week.abnHours.toFixed(2)}</span></div>}
        {week.breakMinsTotal > 0 && <div className="inv-totals-line"><span>Total break</span><span>{week.breakMinsTotal}m</span></div>}
        <div className="inv-totals-line total"><span>Total billed hours</span><span>{week.hours.toFixed(2)}</span></div>
      </div>
    </div>
  );
}

interface Props {
  processed: ProcessedEntry[];
  settings: Settings;
  isAdmin?: boolean;
  isReadOnly?: boolean;
  users?: ManagedUser[];
  onEdit?: (e: ProcessedEntry) => void;
  onDelete?: (id: string) => void | Promise<void>;
}

export const WeeklyReport = React.memo(function WeeklyReport({ processed, settings, isAdmin, isReadOnly, users, onEdit, onDelete }: Props) {
  const [expanded,      setExpanded]      = React.useState<Record<string, boolean>>({});
  const [selectedWeek,  setSelectedWeek]  = React.useState<WeekSummary | null>(null);
  const [downloading,   setDownloading]   = React.useState(false);
  const [workerFilter,  setWorkerFilter]  = React.useState("all");
  const [deletingId,    setDeletingId]    = React.useState<string | null>(null);

  const canEdit = !isReadOnly && (onEdit || onDelete);

  const handleDeleteClick = async (id: string) => {
    if (!onDelete) return;
    setDeletingId(id);
    try { await onDelete(id); } finally { setDeletingId(null); }
  };

  const visible = React.useMemo(() =>
    isAdmin && workerFilter !== "all"
      ? processed.filter(e => e.ownerId === workerFilter)
      : processed,
  [processed, isAdmin, workerFilter]);

  const { weeks, grandTotal } = React.useMemo(() => {
    const weekMap: Record<string, ProcessedEntry[]> = {};
    visible.forEach(e => {
      const ws = weekStart(e.date);
      if (!weekMap[ws]) weekMap[ws] = [];
      weekMap[ws].push(e);
    });

    const weeks: WeekSummary[] = Object.keys(weekMap).sort().map(ws => {
      const entries = weekMap[ws];
      return entries.reduce<WeekSummary>((a, e) => ({
        weekStart:      ws,
        entries,
        hours:          a.hours         + e.total,
        breakMinsTotal: a.breakMinsTotal + (e.breakMins || 0),
        regular:        a.regular        + e.regular,
        overtime:       a.overtime       + e.overtime,
        tfnHours:       a.tfnHours       + e.tfnPortion,
        abnHours:       a.abnHours       + e.abnPortion,
        tfnEarnings:    a.tfnEarnings    + e.tfnEarnings,
        abnEarnings:    a.abnEarnings    + e.abnEarnings,
        total:          a.total          + e.totalEarnings,
      }), { weekStart: ws, entries, hours:0, breakMinsTotal:0, regular:0, overtime:0, tfnHours:0, abnHours:0, tfnEarnings:0, abnEarnings:0, total:0 });
    });

    const grandTotal = weeks.reduce<Omit<WeekSummary, "weekStart"|"entries">>((a, w) => ({
      hours:          a.hours          + w.hours,
      breakMinsTotal: a.breakMinsTotal + w.breakMinsTotal,
      regular:        a.regular        + w.regular,
      overtime:       a.overtime       + w.overtime,
      tfnHours:       a.tfnHours       + w.tfnHours,
      abnHours:       a.abnHours       + w.abnHours,
      tfnEarnings:    a.tfnEarnings    + w.tfnEarnings,
      abnEarnings:    a.abnEarnings    + w.abnEarnings,
      total:          a.total          + w.total,
    }), { hours:0, breakMinsTotal:0, regular:0, overtime:0, tfnHours:0, abnHours:0, tfnEarnings:0, abnEarnings:0, total:0 });

    return { weeks, grandTotal };
  }, [visible]);

  const userMap = React.useMemo(() =>
    new Map((users ?? []).map(u => [u.id, u.name])),
  [users]);

  if (weeks.length === 0) {
    return (
      <>
        {isAdmin && users && users.length > 0 && (
          <div className="no-print" style={{ marginBottom: 16 }}>
            <WorkerFilter users={users} value={workerFilter} onChange={setWorkerFilter} />
          </div>
        )}
        <div className="empty-state">
          <i className="ti ti-calendar-week" aria-hidden="true" style={{ fontSize: 36, color: "var(--color-text-tertiary)" }} />
          <p>No entries in this period</p>
        </div>
      </>
    );
  }

  if (selectedWeek) {
    return (
      <div>
        <div className="print-actions no-print">
          <button className="btn-secondary" onClick={() => setSelectedWeek(null)}>
            <i className="ti ti-arrow-left" aria-hidden="true" /> All weeks
          </button>
          <button className="btn-secondary" disabled={downloading} onClick={async () => {
            setDownloading(true);
            const filename = `Timesheet-${selectedWeek.weekStart}-${weekEnd(selectedWeek.weekStart)}.pdf`;
            await downloadPdf("week-timesheet-doc", filename);
            setDownloading(false);
          }}>
            <i className="ti ti-download" aria-hidden="true" />
            {downloading ? "Generating…" : "Download PDF"}
          </button>
        </div>
        <WeekTimesheetDoc week={selectedWeek} settings={settings} />
      </div>
    );
  }

  return (
    <div id="weekly-report-doc">
      <h2 className="sr-only">Weekly report</h2>

      <div className="print-actions no-print" style={{ justifyContent: "space-between", alignItems: "center" }}>
        {isAdmin && users && users.length > 0
          ? <WorkerFilter users={users} value={workerFilter} onChange={setWorkerFilter} />
          : <span />
        }
        <button className="btn-secondary" disabled={downloading} onClick={async () => {
          setDownloading(true);
          await downloadPdf("weekly-report-doc", "Weekly-Report.pdf");
          setDownloading(false);
        }}>
          <i className="ti ti-download" aria-hidden="true" />
          {downloading ? "Generating…" : "Download PDF"}
        </button>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>Period summary by week</p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Entries</th>
              <th>Break</th>
              <th>Billed hrs</th>
              <th>Regular</th>
              <th>Overtime</th>
              <th>TFN hrs</th>
              <th>ABN hrs</th>
              <th>TFN earnings</th>
              <th>ABN earnings</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {weeks.map(w => (
              <React.Fragment key={w.weekStart}>
                <tr>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{weekLabel(w.weekStart)}</td>
                  <td>{w.entries.length}</td>
                  <td className="mono muted">{w.breakMinsTotal > 0 ? `${w.breakMinsTotal}m` : "—"}</td>
                  <td className="mono">
                    {fh(w.hours)}
                    {w.overtime > 0 && (
                      <span style={{ marginLeft: 4, color: "var(--color-text-tertiary)", fontSize: 11 }}>
                        ({fh(w.regular + w.overtime * 1.5)})
                      </span>
                    )}
                  </td>
                  <td className="mono">{fh(w.regular)}</td>
                  <td className="mono">{w.overtime > 0 ? <Bdg type="ot">{fh(w.overtime)}</Bdg> : <span className="muted">—</span>}</td>
                  <td className="mono">{w.tfnHours > 0 ? <Bdg type="tfn">{fh(w.tfnHours)}</Bdg> : <span className="muted">—</span>}</td>
                  <td className="mono">{w.abnHours > 0 ? <Bdg type="abn">{fh(w.abnHours)}</Bdg> : <span className="muted">—</span>}</td>
                  <td className="mono" style={{ color: "var(--color-text-success)" }}>{fc(w.tfnEarnings)}</td>
                  <td className="mono" style={{ color: "var(--color-text-info)" }}>{fc(w.abnEarnings)}</td>
                  <td className="mono" style={{ fontWeight: 500 }}>{fc(w.total)}</td>
                  <td>
                    <span style={{ display: "flex", gap: 4 }}>
                      {!isAdmin && (
                        <button className="icon-btn-sm no-print" onClick={() => setSelectedWeek(w)} aria-label="Print week report">
                          <i className="ti ti-printer" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        className="icon-btn-sm no-print"
                        onClick={() => setExpanded(prev => ({ ...prev, [w.weekStart]: !prev[w.weekStart] }))}
                        aria-label={expanded[w.weekStart] ? "Collapse" : "Expand"}
                      >
                        <i className={`ti ${expanded[w.weekStart] ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                </tr>

                {expanded[w.weekStart] && w.entries.map(e => (
                  <tr key={e.id} style={{ background: "var(--color-background-secondary)", opacity: e.archived ? 0.65 : 1 }}>
                    <td className="mono muted" style={{ fontSize: 11, paddingLeft: 24 }}>
                      {fd(e.date)}
                      {e.archived && <span style={{ marginLeft: 6, fontSize: 10, background: "var(--color-background-tertiary)", color: "var(--color-text-tertiary)", padding: "1px 5px", borderRadius: 3 }}>invoiced</span>}
                    </td>
                    <td colSpan={isAdmin ? 1 : 2} style={{ fontSize: 12, maxWidth: 200 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.jobDescription}</div>
                      {e.client && (
                        <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <i className="ti ti-building" aria-hidden="true" style={{ marginRight: 3 }} />{e.client}
                        </div>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ fontSize: 11, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                        {userMap.get(e.ownerId ?? "") ?? "—"}
                      </td>
                    )}
                    <td className="mono" style={{ fontSize: 12 }}>
                      {e.startTime}–{e.endTime}
                      {e.breakMins > 0 && <span className="muted"> −{e.breakMins}m</span>}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {fh(e.regular)}
                      {e.overtime > 0 && (
                        <span style={{ marginLeft: 4, color: "var(--color-text-tertiary)", fontSize: 10 }}>
                          ({fh(e.regular + e.overtime * 1.5)})
                        </span>
                      )}
                    </td>
                    <td>{e.overtime > 0 ? <Bdg type="ot">{fh(e.overtime)}</Bdg> : <span className="muted">—</span>}</td>
                    <td>{e.tfnPortion > 0 ? <Bdg type="tfn">{fh(e.tfnPortion)}</Bdg> : <span className="muted">—</span>}</td>
                    <td>{e.abnPortion > 0 ? <Bdg type="abn">{fh(e.abnPortion)}</Bdg> : <span className="muted">—</span>}</td>
                    <td className="mono" style={{ fontSize: 12, color: "var(--color-text-success)" }}>{fc(e.tfnEarnings)}</td>
                    <td className="mono" style={{ fontSize: 12, color: "var(--color-text-info)" }}>{fc(e.abnEarnings)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fc(e.totalEarnings)}</td>
                    <td>
                      {canEdit && (
                        <span style={{ display: "flex", gap: 4 }}>
                          {onEdit && (
                            <button className="icon-btn-sm no-print" onClick={() => onEdit(e)} aria-label="Edit" title={e.archived ? "Editing recalculates the saved invoice" : "Edit"}>
                              <i className="ti ti-edit" aria-hidden="true" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              className="icon-btn-sm danger no-print"
                              onClick={() => handleDeleteClick(e.id)}
                              disabled={deletingId === e.id}
                              aria-label={deletingId === e.id ? "Deleting…" : "Delete"}
                            >
                              <i className={`ti ${deletingId === e.id ? "ti-loader-2" : "ti-trash"}`} aria-hidden="true" />
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "1px solid var(--color-border-secondary)" }}>
              <td style={{ fontWeight: 500, fontSize: 12 }}>Total</td>
              <td>{visible.length}</td>
              <td className="mono muted">{grandTotal.breakMinsTotal > 0 ? `${grandTotal.breakMinsTotal}m` : "—"}</td>
              <td className="mono" style={{ fontWeight: 500 }}>
                {fh(grandTotal.hours)}
                {grandTotal.overtime > 0 && (
                  <span style={{ marginLeft: 4, color: "var(--color-text-tertiary)", fontSize: 11, fontWeight: 400 }}>
                    ({fh(grandTotal.regular + grandTotal.overtime * 1.5)})
                  </span>
                )}
              </td>
              <td className="mono">{fh(grandTotal.regular)}</td>
              <td className="mono">{grandTotal.overtime > 0 ? <Bdg type="ot">{fh(grandTotal.overtime)}</Bdg> : <span className="muted">—</span>}</td>
              <td className="mono">{grandTotal.tfnHours > 0 ? <Bdg type="tfn">{fh(grandTotal.tfnHours)}</Bdg> : <span className="muted">—</span>}</td>
              <td className="mono">{grandTotal.abnHours > 0 ? <Bdg type="abn">{fh(grandTotal.abnHours)}</Bdg> : <span className="muted">—</span>}</td>
              <td className="mono" style={{ fontWeight: 500, color: "var(--color-text-success)" }}>{fc(grandTotal.tfnEarnings)}</td>
              <td className="mono" style={{ fontWeight: 500, color: "var(--color-text-info)" }}>{fc(grandTotal.abnEarnings)}</td>
              <td className="mono" style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)" }}>{fc(grandTotal.total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
});

function WorkerFilter({ users, value, onChange }: { users: ManagedUser[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <i className="ti ti-user" style={{ fontSize: 14, color: "var(--color-text-secondary)" }} aria-hidden="true" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontSize: 13,
          padding: "4px 8px",
          border: "0.5px solid var(--color-border-secondary)",
          borderRadius: "var(--border-radius-sm)",
          background: "var(--color-background-secondary)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
        }}
        aria-label="Filter by worker"
      >
        <option value="all">All workers</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.name || u.email}</option>
        ))}
      </select>
    </div>
  );
}
