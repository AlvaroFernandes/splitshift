import React, { useState, useMemo } from "react";
import type { ManagedUser, ProcessedEntry } from "@/types";
import { fh, fc, fd } from "@/lib/formatters";
import { Bdg } from "./ui";

function csvEsc(v: string | number): string {
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadEntriesCSV(rows: ProcessedEntry[], userMap: Map<string, string>, isAdmin: boolean) {
  const header = [
    "Date", "Job Description", "Client",
    ...(isAdmin ? ["Worker"] : []),
    "Start", "End", "Break (min)", "Hours", "Rate (AUD/h)",
    "TFN Hrs", "ABN Hrs", "OT Hrs",
    "TFN Earnings", "ABN Earnings", "Total Earnings",
  ].map(csvEsc).join(",");

  const lines = rows.map(e => [
    e.date,
    e.jobDescription,
    e.client ?? "",
    ...(isAdmin ? [userMap.get(e.ownerId ?? "") ?? ""] : []),
    e.startTime,
    e.endTime,
    e.breakMins,
    e.total.toFixed(2),
    e.hourlyRate.toFixed(2),
    e.tfnPortion.toFixed(2),
    e.abnPortion.toFixed(2),
    e.overtime.toFixed(2),
    e.tfnEarnings.toFixed(2),
    e.abnEarnings.toFixed(2),
    e.totalEarnings.toFixed(2),
  ].map(csvEsc).join(","));

  const blob = new Blob([[header, ...lines].join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `entries-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const EntriesList = React.memo(function EntriesList({ processed, archivedProcessed, onEdit, onDelete, isAdmin, isReadOnly, users, userFilter, onUserFilterChange }: {
  processed: ProcessedEntry[];
  archivedProcessed?: ProcessedEntry[];
  onEdit: (e: ProcessedEntry) => void;
  onDelete: (id: string) => void | Promise<void>;
  isAdmin?: boolean;
  isReadOnly?: boolean;
  users?: ManagedUser[];
  userFilter?: string;
  onUserFilterChange?: (v: string) => void;
}) {
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [clientFilter,  setClientFilter]  = useState<string>("all");
  const [showInvoiced,  setShowInvoiced]  = useState(false);

  const handleDeleteClick = async (id: string) => {
    setDeletingId(id);
    try { await onDelete(id); } finally { setDeletingId(null); }
  };

  const hasArchived = (archivedProcessed?.length ?? 0) > 0;

  const combined = useMemo(() => {
    if (!showInvoiced || !archivedProcessed || archivedProcessed.length === 0) return processed;
    return [...processed, ...archivedProcessed].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
    });
  }, [processed, archivedProcessed, showInvoiced]);

  const clientOptions = useMemo(() =>
    [...new Set(combined.map(e => e.client).filter(Boolean))].sort() as string[],
  [combined]);

  const visible = useMemo(() => {
    let rows = isAdmin && userFilter && userFilter !== "all"
      ? combined.filter(e => e.ownerId === userFilter)
      : combined;
    if (clientFilter !== "all") rows = rows.filter(e => e.client === clientFilter);
    return rows;
  }, [combined, isAdmin, userFilter, clientFilter]);

  const userMap = useMemo(
    () => new Map((users ?? []).map(u => [u.id, u.name])),
    [users],
  );

  const hasClients = clientOptions.length > 0;

  return (
    <div>
      <h2 className="sr-only">All entries for current period</h2>

      {hasArchived && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer", width: "fit-content" }}>
            <input type="checkbox" checked={showInvoiced} onChange={e => setShowInvoiced(e.target.checked)} />
            Show already-invoiced weeks
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>(editing one updates its saved invoice)</span>
          </label>
        </div>
      )}

      {(isAdmin && users && users.length > 0 || hasClients) && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {isAdmin && users && users.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="user-filter" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>User:</label>
              <select
                id="user-filter"
                value={userFilter ?? "all"}
                onChange={e => onUserFilterChange?.(e.target.value)}
                style={{ fontSize: 13, padding: "4px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}
              >
                <option value="all">All users</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          {hasClients && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="client-filter" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Client:</label>
              <select
                id="client-filter"
                value={clientFilter}
                onChange={e => setClientFilter(e.target.value)}
                style={{ fontSize: 13, padding: "4px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}
              >
                <option value="all">All clients</option>
                {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{visible.length} entries</span>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: "4px 10px", marginLeft: "auto" }}
            onClick={() => downloadEntriesCSV(visible, userMap, !!isAdmin)}
            disabled={visible.length === 0}
          >
            <i className="ti ti-download" aria-hidden="true" /> CSV
          </button>
        </div>
      )}

      {!(isAdmin && users && users.length > 0 || hasClients) && visible.length > 0 && (
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: "4px 10px" }}
            onClick={() => downloadEntriesCSV(visible, userMap, !!isAdmin)}
          >
            <i className="ti ti-download" aria-hidden="true" /> CSV
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-list" aria-hidden="true" style={{ fontSize: 36, color: "var(--color-text-tertiary)" }} />
          <p>No entries{isAdmin ? " for this selection" : " in this period"}</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {isAdmin && <th>User</th>}
                <th>Job</th>
                {hasClients && <th>Client</th>}
                <th>Time</th>
                <th>Hours</th><th>Rate</th>
                {!isAdmin && <th>Split</th>}
                <th>Earnings</th>
                {!isReadOnly && <th></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map(e => (
                <tr key={e.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{fd(e.date)}</td>
                  {isAdmin && (
                    <td style={{ fontSize: 12 }}>
                      {userMap.get(e.ownerId ?? "") ?? "—"}
                    </td>
                  )}
                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.jobDescription}
                    {e.archived && (
                      <span className="muted" style={{ marginLeft: 6, fontSize: 11 }} title="Already invoiced — editing recalculates the saved invoice">
                        <i className="ti ti-receipt" aria-hidden="true" /> invoiced
                      </span>
                    )}
                  </td>
                  {hasClients && (
                    <td style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                      {e.client ?? <span className="muted">—</span>}
                    </td>
                  )}
                  <td className="mono" style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>
                    {e.startTime}–{e.endTime}
                    {e.breakMins > 0 && (
                      <span style={{ marginLeft: 4, color: "var(--color-text-tertiary)" }}>−{e.breakMins}m</span>
                    )}
                  </td>
                  <td className="mono">
                    {fh(e.total)}
                    {e.overtime > 0 && (
                      <span style={{ marginLeft: 4, color: "var(--color-text-tertiary)", fontSize: 11 }}>
                        ({fh(e.regular + e.overtime * 1.5)})
                      </span>
                    )}
                  </td>
                  <td className="mono">{fc(e.hourlyRate)}/h</td>
                  {!isAdmin && (
                    <td style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                      {e.tfnPortion > 0 && <Bdg type="tfn">TFN {fh(e.tfnPortion)}</Bdg>}
                      {e.abnPortion > 0 && <Bdg type="abn">ABN {fh(e.abnPortion)}</Bdg>}
                      {e.overtime    > 0 && <Bdg type="ot">OT {fh(e.overtime)}</Bdg>}
                    </td>
                  )}
                  <td className="mono">{fc(e.totalEarnings)}</td>
                  {!isReadOnly && (
                    <td>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button className="icon-btn-sm" onClick={() => onEdit(e)} aria-label="Edit">
                          <i className="ti ti-edit" aria-hidden="true" />
                        </button>
                        <button
                          className="icon-btn-sm danger"
                          onClick={() => handleDeleteClick(e.id)}
                          disabled={deletingId === e.id}
                          aria-label={deletingId === e.id ? "Deleting…" : "Delete"}
                        >
                          <i className={`ti ${deletingId === e.id ? "ti-loader-2" : "ti-trash"}`} aria-hidden="true" />
                        </button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
