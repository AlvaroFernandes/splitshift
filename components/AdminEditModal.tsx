import React, { useState, useMemo } from "react";
import type { Entry, FormState } from "@/types";
import { calcHours, MIN_HOURS } from "@/lib/calculations";
import { fh, fc } from "@/lib/formatters";

export const AdminEditModal = React.memo(function AdminEditModal({ entry, userName, onSave, onClose, clients }: {
  entry: Entry;
  userName: string;
  onSave: (updated: Entry) => void;
  onClose: () => void;
  clients?: string[];
}) {
  const [form, setForm] = useState<FormState>({
    date:           entry.date,
    jobDescription: entry.jobDescription,
    startTime:      entry.startTime,
    endTime:        entry.endTime,
    hourlyRate:     String(entry.hourlyRate),
    breakMins:      entry.breakMins ? String(entry.breakMins) : "",
    client:         entry.client || "",
    officeHours:    entry.officeHours ?? false,
  });
  const f = (k: keyof FormState, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const { breakMinsNum, previewRaw, previewActual, previewH, previewEarn } = useMemo(() => {
    const breakMinsNum  = Math.max(0, parseInt(form.breakMins || "0") || 0);
    const previewRaw    = calcHours(form.startTime, form.endTime);
    const previewActual = Math.max(0, previewRaw - breakMinsNum / 60);
    const previewH      = form.officeHours ? previewActual : Math.max(MIN_HOURS, previewActual);
    return { breakMinsNum, previewRaw, previewActual, previewH, previewEarn: previewH * parseFloat(form.hourlyRate || "0") };
  }, [form.breakMins, form.startTime, form.endTime, form.hourlyRate, form.officeHours]);

  const handleSave = () => {
    if (!form.date || !form.jobDescription.trim() || !form.startTime || !form.endTime || !form.hourlyRate) return;
    if (calcHours(form.startTime, form.endTime) <= 0) return;
    const hourlyRateNum = parseFloat(form.hourlyRate);
    if (isNaN(hourlyRateNum) || hourlyRateNum < 0) return;
    onSave({
      ...entry,
      date:           form.date,
      jobDescription: form.jobDescription.trim(),
      startTime:      form.startTime,
      endTime:        form.endTime,
      hourlyRate:     hourlyRateNum,
      breakMins:      breakMinsNum,
      officeHours:    form.officeHours ?? false,
      client:         form.client.trim() || undefined,
    });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ fontWeight: 600, margin: 0 }}>Edit Entry</p>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{userName}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="form-grid">
          <div className="field full">
            <label>Job description</label>
            <input type="text" value={form.jobDescription} onChange={e => f("jobDescription", e.target.value)} />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={e => f("date", e.target.value)} />
          </div>
          <div className="field">
            <label>Hourly rate (AUD)</label>
            <input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={e => f("hourlyRate", e.target.value)} />
          </div>
          <div className="field">
            <label>Start time</label>
            <input type="time" value={form.startTime} onChange={e => f("startTime", e.target.value)} />
          </div>
          <div className="field">
            <label>End time</label>
            <input type="time" value={form.endTime} onChange={e => f("endTime", e.target.value)} />
          </div>
          <div className="field">
            <label>Break (mins)</label>
            <input type="number" min="0" step="5" value={form.breakMins} onChange={e => f("breakMins", e.target.value)} />
          </div>
          <div className="field full">
            <label>Client / Project <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
            <input type="text" list="am-client-list" placeholder="e.g. Acme Corp" value={form.client} onChange={e => f("client", e.target.value)} />
            {clients && clients.length > 0 && (
              <datalist id="am-client-list">
                {clients.map(c => <option key={c} value={c} />)}
              </datalist>
            )}
          </div>
          <div className="field full">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.officeHours === true}
                onChange={() => setForm(prev => ({ ...prev, officeHours: !prev.officeHours }))}
              />
              Office hours
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-tertiary)" }}>(no 4-hour minimum call)</span>
            </label>
          </div>
        </div>

        {previewRaw > 0 && (
          <div className="preview-box">
            <span>
              <span className="muted">Billed: </span>
              <strong className="mono">{fh(previewH)}</strong>
            </span>
            <span>
              <span className="muted">Est. earnings: </span>
              <strong className="mono" style={{ color: "var(--color-text-success)" }}>
                {fc(previewEarn)}
              </strong>
            </span>
            {previewActual < previewRaw && (
              <span className="muted" style={{ fontSize: 12 }}>after {breakMinsNum}m break</span>
            )}
          </div>
        )}

        <div className="btn-row">
          <button className="btn-primary" onClick={handleSave}>
            <i className="ti ti-check" aria-hidden="true" /> Update Entry
          </button>
          <button className="btn-secondary" onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
});
