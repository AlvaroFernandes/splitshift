import React, { useMemo, useState } from "react";
import type { ManagedUser, ProcessedEntry, Settings } from "@/types";
import type { BankClosure } from "@/services/bankClosures";
import type { BankAdjustment } from "@/services/bankAdjustments";
import { fh, fd, todayStr } from "@/lib/formatters";
import { bankBalance } from "@/lib/hourBank";
import { Metric, Bdg } from "./ui";

const fhSigned = (h: number) => (h < 0 ? `−${fh(-h)}` : fh(h));

// Admin view of every Hour Bank worker's balance, where the admin records
// banked hours that have been paid out (deducted from the balance) or adds
// hours back as a correction. Balances are all-time, independent of the
// header's period filter. processed: all-time processed entries for the team
// (open entries count as pending, same as the worker's own Hour Bank tab).
export const BankAdmin = React.memo(function BankAdmin({ users, workerSettings, processed, closuresByWorker, adjustmentsByWorker, onAdd, onRemove }: {
  users: ManagedUser[];
  workerSettings: Record<string, Settings>;
  processed: ProcessedEntry[];
  closuresByWorker: Record<string, BankClosure[]>;
  adjustmentsByWorker: Record<string, BankAdjustment[]>;
  onAdd: (params: { workerId: string; date: string; hours: number; note: string }) => Promise<boolean>;
  onRemove: (adj: BankAdjustment) => void;
}) {
  const [selected,   setSelected]   = useState<string | null>(null);
  const [direction,  setDirection]  = useState<"payout" | "add">("payout");
  const [hrs,        setHrs]        = useState("");
  const [mins,       setMins]       = useState("");
  const [date,       setDate]       = useState(todayStr());
  const [note,       setNote]       = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Workers currently on Hour Bank, plus anyone switched away who still has
  // a bank history — their frozen balance can still be paid out.
  const rows = useMemo(() => users
    .map(u => {
      const closures    = closuresByWorker[u.id] ?? [];
      const adjustments = adjustmentsByWorker[u.id] ?? [];
      const onBank      = workerSettings[u.id]?.excessMode === "bank";
      const b = bankBalance(closures, adjustments, processed.filter(e => e.ownerId === u.id));
      const paidOut = -adjustments.filter(a => a.hours < 0).reduce((s, a) => s + a.hours, 0);
      return { ...u, ...b, paidOut, onBank, adjustments, hasHistory: closures.some(c => c.mode === "bank") || adjustments.length > 0 };
    })
    .filter(r => r.onBank || r.hasHistory)
    .sort((a, b) => b.balance - a.balance),
  [users, workerSettings, processed, closuresByWorker, adjustmentsByWorker]);

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  const totalPaid    = rows.reduce((s, r) => s + r.paidOut, 0);
  const current      = rows.find(r => r.id === selected) ?? null;

  const openForm = (id: string) => {
    setSelected(prev => (prev === id ? null : id));
    setDirection("payout"); setHrs(""); setMins(""); setDate(todayStr()); setNote(""); setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const amount = (parseInt(hrs || "0") || 0) + (parseInt(mins || "0") || 0) / 60;
    if (amount <= 0) { setError("Enter how many hours."); return; }
    if (!date) { setError("Pick a date."); return; }
    // Small epsilon so paying out the exact balance isn't blocked by rounding
    if (direction === "payout" && amount > current.balance + 1e-6) {
      setError(`Can't pay out more than the current balance (${fh(current.balance)}).`);
      return;
    }
    setSaving(true);
    const ok = await onAdd({
      workerId: current.id, date, note: note.trim(),
      hours: direction === "payout" ? -amount : amount,
    });
    setSaving(false);
    if (ok) openForm(current.id);
  };

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <i className="ti ti-clock-dollar" aria-hidden="true" style={{ fontSize: 36, color: "var(--color-text-tertiary)" }} />
        <p>No Hour Bank workers</p>
        <p className="muted" style={{ fontSize: 12 }}>
          Switch a worker&apos;s excess hours to Hour Bank on the Team tab to track their bank here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="sr-only">Hour bank</h2>

      <div className="metric-grid">
        <Metric label="Total owed"    value={fh(totalBalance)} sub="all Hour Bank balances" bold />
        <Metric label="Paid out"      value={fh(totalPaid)}    sub="all time"               color="info" />
        <Metric label="Workers"       value={String(rows.length)} sub="with an Hour Bank" />
      </div>

      <div className="card mt-3" style={{ overflowX: "auto" }}>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
          Balances include hours accruing in weeks not yet closed. Record a payout once banked hours have been paid.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Banked</th>
              <th>Paid out / adjusted</th>
              <th>Pending</th>
              <th>Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                    {r.onBank ? r.email : "No longer on Hour Bank"}
                  </div>
                </td>
                <td className="mono">{fh(r.closed)}</td>
                <td className="mono">{r.adjusted === 0 ? <span className="muted">—</span> : fhSigned(r.adjusted)}</td>
                <td className="mono">{r.pending > 0 ? fh(r.pending) : <span className="muted">—</span>}</td>
                <td className="mono" style={{ fontWeight: 600, color: "var(--color-text-bank)" }}>{fhSigned(r.balance)}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn-secondary" style={{ fontSize: 12, padding: "4px 10px", marginLeft: "auto" }}
                    onClick={() => openForm(r.id)} aria-expanded={selected === r.id}>
                    <i className="ti ti-adjustments" aria-hidden="true" /> Adjust
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current && (
        <div className="card mt-3">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <p style={{ fontWeight: 600, margin: 0 }}>Adjust Hour Bank</p>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                {current.name} · balance <span className="mono">{fhSigned(current.balance)}</span>
              </p>
            </div>
            <button className="icon-btn-sm" onClick={() => setSelected(null)} aria-label="Close">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="field full">
              <label htmlFor="ba-dir">Type</label>
              <select id="ba-dir" value={direction} onChange={e => setDirection(e.target.value as "payout" | "add")}>
                <option value="payout">Hours paid out (deduct from bank)</option>
                <option value="add">Add hours (correction)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ba-hrs">Hours</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input id="ba-hrs" type="number" min="0" step="1" inputMode="numeric" placeholder="0"
                  value={hrs} onChange={e => setHrs(e.target.value)} style={{ width: "100%" }} />
                <span className="muted" style={{ fontSize: 12 }}>h</span>
                <input type="number" min="0" max="59" step="1" inputMode="numeric" placeholder="00" aria-label="Minutes"
                  value={mins} onChange={e => setMins(e.target.value)} style={{ width: "100%" }} />
                <span className="muted" style={{ fontSize: 12 }}>m</span>
              </div>
              {direction === "payout" && current.balance > 0 && (
                <button type="button" className="muted" onClick={() => {
                  const totalMins = Math.round(current.balance * 60);
                  setHrs(String(Math.floor(totalMins / 60))); setMins(String(totalMins % 60));
                }} style={{ background: "none", border: "none", padding: 0, fontSize: 12, textAlign: "left", cursor: "pointer", textDecoration: "underline" }}>
                  Pay out full balance
                </button>
              )}
            </div>
            <div className="field">
              <label htmlFor="ba-date">{direction === "payout" ? "Paid on" : "Date"}</label>
              <input id="ba-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="ba-note">Note <span className="label-hint">optional, visible to the worker</span></label>
              <input id="ba-note" type="text" placeholder="e.g. Paid with fortnightly pay run"
                value={note} onChange={e => setNote(e.target.value)} maxLength={200} />
            </div>
            {error && (
              <p role="alert" style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, color: "var(--color-text-danger)" }}>{error}</p>
            )}
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                <i className="ti ti-check" aria-hidden="true" /> {direction === "payout" ? "Record payout" : "Add hours"}
              </button>
            </div>
          </form>

          {current.adjustments.length > 0 && (
            <div style={{ marginTop: 20, overflowX: "auto" }}>
              <p className="section-label">Adjustment history</p>
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Change</th><th>Note</th><th /></tr>
                </thead>
                <tbody>
                  {current.adjustments.map(a => (
                    <tr key={a.id}>
                      <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fd(a.date)}</td>
                      <td className="mono">
                        {a.hours < 0 ? <Bdg type="danger">−{fh(-a.hours)}</Bdg> : <Bdg type="bank">+{fh(a.hours)}</Bdg>}
                      </td>
                      <td style={{ fontSize: 12 }}>{a.note || <span className="muted">—</span>}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {confirmDel === a.id ? (
                          <>
                            <button className="icon-btn-sm danger" onClick={() => { setConfirmDel(null); onRemove(a); }}
                              style={{ fontSize: 12 }}>Remove</button>{" "}
                            <button className="icon-btn-sm" onClick={() => setConfirmDel(null)} style={{ fontSize: 12 }}>Keep</button>
                          </>
                        ) : (
                          <button className="icon-btn-sm danger" onClick={() => setConfirmDel(a.id)} aria-label="Remove adjustment">
                            <i className="ti ti-trash" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
