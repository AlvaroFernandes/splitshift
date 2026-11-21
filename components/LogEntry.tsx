import React from "react";
import type { Entry, EntryTemplate, FormState, LeaveType, Settings } from "@/types";
import { calcHours, MIN_HOURS, LEAVE_LABELS, leaveDayHours, leaveEndTime } from "@/lib/calculations";
import { fh, fc, todayStr, alpha } from "@/lib/formatters";

const OFFICE_JOB_DESCRIPTION = "Office hours";
// Office-hours shifts are worked for Hands On itself, not an external client.
const OFFICE_CLIENT = "Hands On";

const BREAK_OPTIONS = [
  { value: "0",  label: "None"   },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 hour" },
];
const OTHER_BREAK = "other";
const isPresetBreak = (mins: string) =>
  BREAK_OPTIONS.some(o => o.value === String(parseInt(mins || "0") || 0));

export const LogEntry = React.memo(function LogEntry({ editEntry, onSave, onCancel, clients, templates, onSaveTemplate, settings }: {
  editEntry?: Entry | null;
  onSave: (formData: FormState) => Promise<boolean>;
  onCancel: () => void;
  clients?: string[];
  templates?: EntryTemplate[];
  onSaveTemplate?: (formData: FormState) => void;
  settings: Settings;
}) {
  // Hour-bank workers aren't billed per entry, so they never pick a rate —
  // entries use the admin-set TFN rate. Those marked "office" also skip job
  // description and client, since they only clock in/out + break.
  const isBank       = settings.excessMode === "bank";
  const isOfficeBank = isBank && settings.workerType === "office";
  const bankRate     = settings.tfnRate || settings.defaultRate || "0";
  // Full-time Hour Bank workers can log a paid day off worth weekly hours ÷ 5.
  const leaveHours   = isBank && settings.fullTime ? leaveDayHours(settings) : 0;
  const canLeave     = leaveHours > 0;

  const [form, setForm] = React.useState<FormState>(() =>
    editEntry
      ? {
          date:           editEntry.date,
          jobDescription: editEntry.jobDescription,
          startTime:      editEntry.startTime,
          endTime:        editEntry.endTime,
          hourlyRate:     String(editEntry.hourlyRate),
          breakMins:      editEntry.breakMins ? String(editEntry.breakMins) : "",
          client:         editEntry.client ?? "",
          officeHours:    editEntry.officeHours ?? false,
          leaveType:      editEntry.leaveType ?? "",
        }
      : {
          date: todayStr(), jobDescription: isOfficeBank ? OFFICE_JOB_DESCRIPTION : "",
          startTime: "", endTime: "",
          hourlyRate: isBank ? bankRate : "", breakMins: "", client: "",
          officeHours: isOfficeBank,
        }
  );

  const { breakMinsNum, previewRaw, previewActual, previewH, previewEarn } = React.useMemo(() => {
    const breakMinsNum  = Math.max(0, parseInt(form.breakMins || "0") || 0);
    const previewRaw    = calcHours(form.startTime, form.endTime);
    const previewActual = Math.max(0, previewRaw - breakMinsNum / 60);
    const previewH      = form.officeHours ? previewActual : Math.max(MIN_HOURS, previewActual);
    return { breakMinsNum, previewRaw, previewActual, previewH, previewEarn: previewH * parseFloat(form.hourlyRate || "0") };
  }, [form.breakMins, form.startTime, form.endTime, form.hourlyRate, form.officeHours]);

  // "Other" lets the worker type any break length. Entries saved with a
  // non-preset length (incl. ones from before the fixed choices) open in it.
  const [customBreak, setCustomBreak] = React.useState(() => !isPresetBreak(form.breakMins));
  // The custom length is typed as hours + minutes; form.breakMins keeps the total.
  const [breakHM, setBreakHM] = React.useState(() => {
    const total = parseInt(form.breakMins || "0") || 0;
    return !isPresetBreak(form.breakMins) && total > 0
      ? { h: total >= 60 ? String(Math.floor(total / 60)) : "", m: total % 60 ? String(total % 60) : "" }
      : { h: "", m: "" };
  });

  const setBreakPart = (part: "h" | "m", value: string) => {
    const next = { ...breakHM, [part]: value };
    setBreakHM(next);
    const total = Math.max(0, parseInt(next.h || "0") || 0) * 60 + Math.max(0, parseInt(next.m || "0") || 0);
    f("breakMins", total > 0 ? String(total) : "");
  };

  const onBreakSelect = (value: string) => {
    if (value === OTHER_BREAK) {
      setCustomBreak(true);
      setBreakHM({ h: "", m: "" });
      f("breakMins", "");
    } else {
      setCustomBreak(false);
      f("breakMins", value === "0" ? "" : value);
    }
  };

  const f = (k: keyof FormState, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Office hours pre-fill the client as Hands On; switching back to site work
  // clears it again, unless the worker has since typed a different client.
  const setOfficeHours = (on: boolean) =>
    setForm(prev => ({
      ...prev,
      officeHours: on,
      client: on
        ? (prev.client.trim() ? prev.client : OFFICE_CLIENT)
        : (prev.client === OFFICE_CLIENT ? "" : prev.client),
    }));

  const isLeave = !!form.leaveType;

  // Switching between work and a leave day swaps the fields the form needs.
  const setLeave = (type: LeaveType | "") =>
    setForm(prev => type
      ? {
          ...prev, leaveType: type, jobDescription: LEAVE_LABELS[type],
          startTime: "00:00", endTime: leaveEndTime(leaveHours),
          breakMins: "", client: "", officeHours: true,
          hourlyRate: isBank ? bankRate : prev.hourlyRate,
        }
      : {
          ...prev, leaveType: "", jobDescription: isOfficeBank ? OFFICE_JOB_DESCRIPTION : "",
          startTime: "", endTime: "", client: "", officeHours: isOfficeBank,
        });

  const applyTemplate = (t: EntryTemplate) => {
    setForm(prev => ({
      ...prev,
      jobDescription: t.jobDescription,
      client:      t.client      ?? "",
      hourlyRate:  isBank ? prev.hourlyRate : (t.hourlyRate ?? prev.hourlyRate),
      startTime:   t.startTime   ?? prev.startTime,
      endTime:     t.endTime     ?? prev.endTime,
    }));
  };

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = React.useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    const ok = await onSave(form);
    setIsSaving(false);
    if (ok && !editEntry) {
      setForm(prev => ({
        date: prev.date, jobDescription: isOfficeBank ? OFFICE_JOB_DESCRIPTION : "",
        startTime: "", endTime: "",
        hourlyRate: isBank ? bankRate : "", breakMins: "",
        client: !isOfficeBank && prev.officeHours ? OFFICE_CLIENT : "",
        officeHours: isOfficeBank || !!prev.officeHours,
      }));
      setCustomBreak(false);
      setBreakHM({ h: "", m: "" });
    }
  }, [form, onSave, editEntry, isSaving, isBank, isOfficeBank, bankRate]);

  return (
    <div>
      <h2 className="sr-only">{editEntry ? "Edit entry" : "Log work hours"}</h2>

      {!isOfficeBank && !isLeave && !editEntry && templates && templates.length > 0 && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>Quick fill:</span>
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => applyTemplate(t)}
              style={{
                fontSize: 12, padding: "3px 10px",
                borderRadius: 20,
                border: "0.5px solid var(--color-border-secondary)",
                background: "var(--color-background-secondary)",
                color: "var(--color-text-primary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t.jobDescription}
              {t.client && <span style={{ color: "var(--color-text-secondary)" }}> · {t.client}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ maxWidth: 560 }}>
        <p style={{ fontWeight: 500, marginBottom: 16 }}>
          {editEntry ? "Edit Entry" : "Log Work Hours"}
        </p>
        {editEntry?.archived && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px", marginBottom: 16,
            background: "var(--color-background-secondary)",
            borderLeft: "3px solid var(--color-text-info)",
            borderRadius: "var(--border-radius-md)",
            fontSize: 13,
          }}>
            <i className="ti ti-info-circle" aria-hidden="true" style={{ color: "var(--color-text-info)", flexShrink: 0 }} />
            <span style={{ color: "var(--color-text-secondary)" }}>
              This entry was already invoiced. Saving will recalculate that invoice. The date is locked to keep it in its original week.
            </span>
          </div>
        )}
        {(!isOfficeBank || canLeave) && (
          <div className="log-type">
            <div className="seg-control" role="radiogroup" aria-label="Type of entry">
              {isOfficeBank ? (
                <button type="button" role="radio" aria-checked={!isLeave}
                  className={`seg-option${!isLeave ? " active" : ""}`}
                  onClick={() => setLeave("")}>
                  <i className="ti ti-clock" aria-hidden="true" />
                  Work
                </button>
              ) : (
                <>
                  <button type="button" role="radio" aria-checked={!isLeave && !form.officeHours}
                    className={`seg-option${!isLeave && !form.officeHours ? " active" : ""}`}
                    onClick={() => { if (isLeave) setLeave(""); setOfficeHours(false); }}>
                    <i className="ti ti-helmet" aria-hidden="true" />
                    Site work
                  </button>
                  <button type="button" role="radio" aria-checked={!isLeave && !!form.officeHours}
                    className={`seg-option${!isLeave && form.officeHours ? " active" : ""}`}
                    onClick={() => { if (isLeave) setLeave(""); setOfficeHours(true); }}>
                    <i className="ti ti-building" aria-hidden="true" />
                    Office hours
                  </button>
                </>
              )}
              {canLeave && (
                <button type="button" role="radio" aria-checked={isLeave}
                  className={`seg-option${isLeave ? " active" : ""}`}
                  onClick={() => { if (!isLeave) setLeave("annual"); }}>
                  <i className="ti ti-beach" aria-hidden="true" />
                  Leave
                </button>
              )}
            </div>
            <p className="log-type-hint">
              {isLeave
                ? `A paid day off — counts as ${fh(leaveHours)} toward your week.`
                : isOfficeBank
                  ? "Clock in and out for the day."
                  : form.officeHours
                    ? "Billed as worked — no 4-hour minimum call."
                    : "4-hour minimum call applies to short shifts."}
            </p>
          </div>
        )}

        {isLeave && (
          <section className="form-section">
            <p className="form-section-title">Leave</p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="f-leave-date">Date</label>
                <input id="f-leave-date" type="date" value={form.date} disabled={!!editEntry?.archived} onChange={e => f("date", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="f-leave-type">Type</label>
                <select id="f-leave-type" value={form.leaveType} onChange={e => setLeave(e.target.value as LeaveType)}>
                  {(Object.keys(LEAVE_LABELS) as LeaveType[]).map(t => <option key={t} value={t}>{LEAVE_LABELS[t]}</option>)}
                </select>
              </div>
            </div>
          </section>
        )}

        {!isOfficeBank && !isLeave && (
          <section className="form-section">
            <p className="form-section-title">Job</p>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="f-desc">Job description</label>
                <input id="f-desc" type="text" placeholder="What did you work on?" value={form.jobDescription} onChange={e => f("jobDescription", e.target.value)} />
              </div>
              <div className="field full">
                <label htmlFor="f-client">Client / Project <span className="label-hint">optional</span></label>
                <input id="f-client" type="text" list="f-client-list" placeholder="e.g. Acme Corp" value={form.client} onChange={e => f("client", e.target.value)} />
                {clients && clients.length > 0 && (
                  <datalist id="f-client-list">
                    {[...clients].sort(alpha).map(c => <option key={c} value={c} />)}
                  </datalist>
                )}
              </div>
            </div>
          </section>
        )}

        {!isLeave && <section className="form-section">
          {!isOfficeBank && <p className="form-section-title">Time</p>}
          <div className="form-grid cols-3">
            <div className="field">
              <label htmlFor="f-date">Date</label>
              <input id="f-date" type="date" value={form.date} disabled={!!editEntry?.archived} onChange={e => f("date", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-start">Start</label>
              <input id="f-start" type="time" value={form.startTime} onChange={e => f("startTime", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-end">End</label>
              <input id="f-end" type="time" value={form.endTime} onChange={e => f("endTime", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-break">Break <span className="label-hint">unpaid</span></label>
              <select id="f-break" value={customBreak ? OTHER_BREAK : (form.breakMins || "0")} onChange={e => onBreakSelect(e.target.value)}>
                {BREAK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                <option value={OTHER_BREAK}>Other…</option>
              </select>
            </div>
            {customBreak && (
              <div className="field">
                <label htmlFor="f-break-h">Break length</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input id="f-break-h" type="number" min="0" max="23" step="1" inputMode="numeric" placeholder="0"
                    aria-label="Break hours" style={{ width: "100%", minWidth: 0 }}
                    autoFocus={!editEntry} value={breakHM.h} onChange={e => setBreakPart("h", e.target.value)} />
                  <span className="muted" style={{ fontSize: 12 }}>h</span>
                  <input id="f-break-m" type="number" min="0" max="59" step="1" inputMode="numeric" placeholder="0"
                    aria-label="Break minutes" style={{ width: "100%", minWidth: 0 }}
                    value={breakHM.m} onChange={e => setBreakPart("m", e.target.value)} />
                  <span className="muted" style={{ fontSize: 12 }}>min</span>
                </div>
              </div>
            )}
            {!isBank && (
              <div className="field">
                <label htmlFor="f-rate">Hourly rate <span className="label-hint">AUD</span></label>
                <input id="f-rate" type="number" min="0" step="0.01" placeholder="0.00" value={form.hourlyRate} onChange={e => f("hourlyRate", e.target.value)} />
              </div>
            )}
          </div>
        </section>}

        {!isLeave && previewRaw > 0 && (
          <div className="preview-box">
            <span>
              <span className="muted">{isOfficeBank ? "Worked: " : "On site: "}</span>
              <strong className="mono">{fh(previewRaw)}</strong>
              {breakMinsNum > 0 && (
                <span className="muted"> − {breakMinsNum}m break = <strong className="mono">{fh(previewActual)}</strong></span>
              )}
              {!form.officeHours && previewActual < MIN_HOURS && (
                <span className="muted"> → billed <strong className="mono" style={{ color: "var(--color-text-warning)" }}>{fh(previewH)}</strong> (min. call)</span>
              )}
            </span>
            {!isOfficeBank && previewH > 12 && (
              <span>
                <span className="muted">Overtime: </span>
                <strong className="mono" style={{ color: "var(--color-text-warning)" }}>
                  {fh(previewH - 12)} ×1.5
                </strong>
              </span>
            )}
            {!isBank && (
              <span>
                <span className="muted">Est. earnings: </span>
                <strong className="mono" style={{ color: "var(--color-text-success)" }}>
                  {fc(previewEarn)}
                </strong>
              </span>
            )}
          </div>
        )}

        <div className="btn-row">
          <button className="btn-primary" onClick={handleSubmit} disabled={isSaving}>
            <i className={`ti ${isSaving ? "ti-loader-2" : "ti-check"}`} aria-hidden="true" />
            {isSaving ? "Saving…" : editEntry ? "Update Entry" : "Add Entry"}
          </button>
          {editEntry ? (
            <button className="btn-secondary" onClick={onCancel}>
              <i className="ti ti-x" aria-hidden="true" />
              Cancel
            </button>
          ) : !isOfficeBank && !isLeave ? (
            <button className="btn-secondary" onClick={() => onSaveTemplate?.(form)} title="Save current fields as a reusable template">
              <i className="ti ti-bookmark" aria-hidden="true" />
              Save as template
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
});
