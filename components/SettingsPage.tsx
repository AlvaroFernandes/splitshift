import React, { useState, useEffect } from "react";
import type { EntryTemplate, ManagedUser, Settings } from "@/types";
import { DEFAULT_SETTINGS } from "@/services/settings";
import { createClient } from "@/lib/supabase";

interface WorkerRule {
  userId: string;
  name: string;
  tfnLimit: number;
  tfnRate: string;
  overtimeThreshold: number;
  excessMode: "abn" | "bank";
  workerType: "office" | "site";
}

interface Props {
  settings: Settings;
  onSave: (s: Settings) => void;
  isAdmin?: boolean;
  managedUsers?: ManagedUser[];
  workerSettings?: Record<string, Settings>;
  onSaveWorkerRules?: (rules: { userId: string; tfnLimit: number; tfnRate: string; overtimeThreshold: number; excessMode: "abn" | "bank"; workerType: "office" | "site" }[]) => void;
}

export const SettingsPage = React.memo(function SettingsPage({ settings, onSave, isAdmin, managedUsers, workerSettings, onSaveWorkerRules }: Props) {
  const [s, setS] = useState<Settings>({ ...DEFAULT_SETTINGS, ...settings });
  const [workerRules,    setWorkerRules]    = useState<WorkerRule[]>([]);
  const [newPwd,         setNewPwd]         = useState("");
  const [confirmPwd,     setConfirmPwd]     = useState("");
  const [pwdLoading,     setPwdLoading]     = useState(false);
  const [pwdMsg,         setPwdMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  const defaultTab = isAdmin ? "company" : "personal";
  const [activeTab, setActiveTab] = useState<"personal" | "rules" | "payment" | "company">(defaultTab as "personal" | "rules" | "payment" | "company");

  const f = (k: keyof Settings, v: string | number) => setS(prev => ({ ...prev, [k]: v }));

  useEffect(() => { setS({ ...DEFAULT_SETTINGS, ...settings }); }, [settings]);

  useEffect(() => {
    setWorkerRules(prev => {
      const next = (managedUsers ?? []).map(u => ({
        userId:            u.id,
        name:              u.name || u.email,
        tfnLimit:          workerSettings?.[u.id]?.tfnLimit          ?? 30,
        tfnRate:           workerSettings?.[u.id]?.tfnRate           ?? "",
        overtimeThreshold: workerSettings?.[u.id]?.overtimeThreshold ?? 12,
        excessMode:       (workerSettings?.[u.id]?.excessMode        ?? "abn") as "abn" | "bank",
        workerType:       (workerSettings?.[u.id]?.workerType        ?? "site") as "office" | "site",
      }));
      if (prev.length === next.length &&
          prev.every((r, i) => r.userId === next[i].userId &&
                               r.tfnLimit === next[i].tfnLimit &&
                               r.tfnRate === next[i].tfnRate &&
                               r.overtimeThreshold === next[i].overtimeThreshold &&
                               r.excessMode === next[i].excessMode &&
                               r.workerType === next[i].workerType))
        return prev;
      return next;
    });
  }, [managedUsers, workerSettings]);

  const STABS = [
    ...(isAdmin ? [] : [{ id: "personal" as const, label: "Personal",   icon: "ti-user"        }]),
    ...(isAdmin ? [{ id: "company" as const, label: "Company",    icon: "ti-building"    }] : []),
    ...(isAdmin ? [{ id: "rules"   as const, label: "Work Rules", icon: "ti-adjustments" }] : []),
    ...(isAdmin ? [] : [{ id: "payment"  as const, label: "Payment",    icon: "ti-credit-card" }]),
  ];

  const ta = (id: string, key: keyof Settings, placeholder: string, rows = 3) => (
    <textarea
      id={id} rows={rows} placeholder={placeholder}
      value={s[key] as string} onChange={e => f(key, e.target.value)}
      style={{ resize: "vertical", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "7px 10px", fontSize: 13, fontFamily: "inherit" }}
    />
  );

  const updateRule = (userId: string, key: "tfnLimit" | "overtimeThreshold", val: number) =>
    setWorkerRules(prev => prev.map(r => r.userId === userId ? { ...r, [key]: val } : r));

  const updateRuleRate = (userId: string, val: string) =>
    setWorkerRules(prev => prev.map(r => r.userId === userId ? { ...r, tfnRate: val } : r));

  const updateRuleMode = (userId: string, val: "abn" | "bank") =>
    setWorkerRules(prev => prev.map(r => r.userId === userId ? { ...r, excessMode: val } : r));

  const updateRuleType = (userId: string, val: "office" | "site") =>
    setWorkerRules(prev => prev.map(r => r.userId === userId ? { ...r, workerType: val } : r));

  // Work Rules' table needs more room than the narrow forms on the other
  // tabs (Personal/Company/Payment) — those stay at a comfortable reading
  // width, while this one gets the space its columns actually need.
  const wrapperMaxWidth = activeTab === "rules" ? 960 : 600;

  return (
    <div style={{ maxWidth: wrapperMaxWidth, margin: "0 auto" }}>
      <h2 className="sr-only">Settings</h2>

      <div className="tabbar no-print" style={{ marginBottom: 16, borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
        {STABS.map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
            <i className={`ti ${t.icon}`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === "personal" && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="s-name">Your name</label>
              <input id="s-name" type="text" value={s.yourName} onChange={e => f("yourName", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="s-abn">Your ABN</label>
              <input id="s-abn" type="text" placeholder="12 345 678 901" value={s.abn} onChange={e => f("abn", e.target.value)} />
            </div>
            <div className="field full">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={s.gstRegistered === true}
                  onChange={e => setS(prev => ({ ...prev, gstRegistered: e.target.checked }))}
                />
                Registered for GST
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-tertiary)" }}>(adds 10% GST to ABN invoices)</span>
              </label>
            </div>
            <div className="field full">
              <label htmlFor="s-addr">Your address</label>
              <input id="s-addr" type="text" placeholder="Street, Suburb - State Postcode" value={s.yourAddress} onChange={e => f("yourAddress", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-phone">Phone</label>
              <input id="s-phone" type="text" placeholder="04XX XXX XXX" value={s.yourPhone} onChange={e => f("yourPhone", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-email">Email</label>
              <input id="s-email" type="email" value={s.yourEmail} onChange={e => f("yourEmail", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-tfnrate">TFN hourly rate (AUD/hr)</label>
              <input id="s-tfnrate" type="number" placeholder="Same as entry rate" value={s.tfnRate} readOnly disabled title="Set by your admin" />
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Set by your admin</span>
            </div>
            <div className="field">
              <label htmlFor="s-rate">Default ABN rate (AUD/hr)</label>
              <input id="s-rate" type="number" min="0" step="0.01" value={s.defaultRate} onChange={e => f("defaultRate", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-invnum">Next invoice #</label>
              <input id="s-invnum" type="number" min="1" value={s.invoiceNum} onChange={e => f("invoiceNum", parseInt(e.target.value) || 1)} />
            </div>
            <div className="field">
              <label htmlFor="s-invdate">Invoice issue date</label>
              <input id="s-invdate" type="date" value={s.invoiceDate || ""} onChange={e => f("invoiceDate", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="s-pdfpat">PDF filename pattern</label>
              <input id="s-pdfpat" type="text" placeholder="Invoice-{num}-{company}-{date}" value={s.pdfNamePattern || ""} onChange={e => f("pdfNamePattern", e.target.value)} />
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}>
                Variables: {"{num}"} {"{company}"} {"{date}"} {"{year}"} {"{month}"} {"{day}"}
              </span>
            </div>
            <div className="field full" style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 16, marginTop: 4 }}>
              <label>Logging reminder</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={s.reminderEnabled !== false}
                    onChange={e => setS(prev => ({ ...prev, reminderEnabled: e.target.checked }))}
                  />
                  Remind me if I haven't logged hours in
                </label>
                <input
                  type="number" min="1" max="30" step="1"
                  value={s.reminderDays ?? 2}
                  onChange={e => setS(prev => ({ ...prev, reminderDays: Math.max(1, parseInt(e.target.value) || 2) }))}
                  disabled={s.reminderEnabled === false}
                  style={{ width: 60 }}
                  aria-label="Reminder threshold in days"
                />
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>days</span>
              </div>
            </div>
            <div className="field full" style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 16, marginTop: 4 }}>
              <label>Saved templates</label>
              {(s.templates ?? []).length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: 0 }}>
                  No templates yet. Use <strong>Save as template</strong> on the Log Entry tab to create one.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {(s.templates ?? []).map((t: EntryTemplate) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "var(--color-background-tertiary)", borderRadius: "var(--border-radius-md)" }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{t.jobDescription}</span>
                        {t.client     && <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: 8 }}>@ {t.client}</span>}
                        {t.hourlyRate && <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginLeft: 8 }}>${t.hourlyRate}/h</span>}
                        {t.startTime && t.endTime && (
                          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginLeft: 8 }}>{t.startTime}–{t.endTime}</span>
                        )}
                      </div>
                      <button
                        className="icon-btn-sm danger"
                        onClick={() => setS(prev => ({ ...prev, templates: (prev.templates ?? []).filter(x => x.id !== t.id) }))}
                        aria-label={`Delete template: ${t.jobDescription}`}
                        style={{ marginLeft: 8, flexShrink: 0 }}
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="field full" style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 16, marginTop: 4 }}>
              <label>Change password</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <input
                  type="password"
                  placeholder="New password"
                  value={newPwd}
                  onChange={e => { setNewPwd(e.target.value); setPwdMsg(null); }}
                  style={{ maxWidth: 280 }}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPwd}
                  onChange={e => { setConfirmPwd(e.target.value); setPwdMsg(null); }}
                  style={{ maxWidth: 280 }}
                />
                {pwdMsg && (
                  <p style={{ fontSize: 12, margin: 0, color: pwdMsg.ok ? "var(--color-text-success)" : "var(--color-text-danger)" }}>
                    {pwdMsg.text}
                  </p>
                )}
                <div>
                  <button
                    className="btn-primary"
                    disabled={pwdLoading || !newPwd || !confirmPwd}
                    onClick={async () => {
                      if (newPwd !== confirmPwd) { setPwdMsg({ text: "Passwords do not match.", ok: false }); return; }
                      if (newPwd.length < 8)     { setPwdMsg({ text: "Password must be at least 8 characters.", ok: false }); return; }
                      setPwdLoading(true);
                      const { error } = await createClient().auth.updateUser({ password: newPwd });
                      setPwdLoading(false);
                      if (error) { setPwdMsg({ text: error.message, ok: false }); }
                      else       { setPwdMsg({ text: "Password updated.", ok: true }); setNewPwd(""); setConfirmPwd(""); }
                    }}
                  >
                    <i className="ti ti-lock" aria-hidden="true" />
                    {pwdLoading ? "Saving…" : "Update password"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "company" && isAdmin && (
          <div className="form-grid">
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px", gridColumn: "1 / -1" }}>
              This information appears on the <strong>Invoice to:</strong> section of every worker's ABN tax invoice.
            </p>
            <div className="field full">
              <label htmlFor="s-cname">Company name</label>
              <input id="s-cname" type="text" placeholder="Acme Pty Ltd" value={s.companyName} onChange={e => f("companyName", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-cabn">Company ABN</label>
              <input id="s-cabn" type="text" placeholder="00 000 000 000" value={s.companyAbn} onChange={e => f("companyAbn", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-cemail">Company email</label>
              <input id="s-cemail" type="email" placeholder="accounts@company.com.au" value={s.companyEmail} onChange={e => f("companyEmail", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="s-caddr">Company address</label>
              <input id="s-caddr" type="text" placeholder="Street, Suburb – State Postcode" value={s.companyAddress} onChange={e => f("companyAddress", e.target.value)} />
            </div>
          </div>
        )}

        {activeTab === "rules" && isAdmin && (
          <>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
              Set TFN hour limit, TFN hourly rate and overtime threshold for each worker. Leave the TFN rate blank to pay TFN hours at each entry&apos;s own rate. These rules are applied independently per worker when calculating their hours and earnings. For Hour Bank workers, choose whether they clock in/out only (Office) or use the full entry form (Site).
            </p>
            {workerRules.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>No managed workers found.</p>
            ) : (
              <table className="data-table" style={{ marginBottom: 4, tableLayout: "fixed", width: "100%" }}>
                <colgroup>
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>TFN hour limit</th>
                    <th style={{ whiteSpace: "normal" }}>TFN rate (AUD/hr)</th>
                    <th style={{ whiteSpace: "normal" }}>Overtime after (hrs/day)</th>
                    <th>Excess hours</th>
                    <th>Worker type</th>
                  </tr>
                </thead>
                <tbody>
                  {workerRules.map(r => (
                    <tr key={r.userId}>
                      <td style={{ fontWeight: 500 }}>{r.name}</td>
                      <td>
                        <input
                          type="number" min="1" step="1"
                          value={r.tfnLimit}
                          onChange={e => updateRule(r.userId, "tfnLimit", parseFloat(e.target.value) || 30)}
                          style={{ width: 80 }}
                          aria-label={`TFN limit for ${r.name}`}
                        />
                        <span style={{ marginLeft: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>hrs</span>
                      </td>
                      <td>
                        <span style={{ marginRight: 4, fontSize: 12, color: "var(--color-text-secondary)" }}>$</span>
                        <input
                          type="number" min="0" step="0.01" placeholder="Entry rate"
                          value={r.tfnRate}
                          onChange={e => updateRuleRate(r.userId, e.target.value)}
                          style={{ width: 90 }}
                          aria-label={`TFN hourly rate for ${r.name}`}
                        />
                      </td>
                      <td>
                        <input
                          type="number" min="1" step="0.5"
                          value={r.overtimeThreshold}
                          onChange={e => updateRule(r.userId, "overtimeThreshold", parseFloat(e.target.value) || 12)}
                          style={{ width: 80 }}
                          aria-label={`Overtime threshold for ${r.name}`}
                        />
                        <span style={{ marginLeft: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>hrs</span>
                      </td>
                      <td>
                        <select
                          value={r.excessMode}
                          onChange={e => updateRuleMode(r.userId, e.target.value as "abn" | "bank")}
                          aria-label={`Excess hours mode for ${r.name}`}
                          style={{
                            width: "100%", maxWidth: 160, boxSizing: "border-box",
                            padding: "4px 8px", fontSize: 12,
                            border: "0.5px solid var(--color-border-secondary)",
                            borderRadius: "var(--border-radius-md)",
                            background: "var(--color-background-secondary)",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          <option value="abn">ABN Invoice</option>
                          <option value="bank">Hour Bank</option>
                        </select>
                      </td>
                      <td>
                        {r.excessMode === "bank" ? (
                          <select
                            value={r.workerType}
                            onChange={e => updateRuleType(r.userId, e.target.value as "office" | "site")}
                            aria-label={`Worker type for ${r.name}`}
                            style={{
                              width: "100%", maxWidth: 180, boxSizing: "border-box",
                              padding: "4px 8px", fontSize: 12,
                              border: "0.5px solid var(--color-border-secondary)",
                              borderRadius: "var(--border-radius-md)",
                              background: "var(--color-background-secondary)",
                              color: "var(--color-text-primary)",
                            }}
                          >
                            <option value="office">Office (clock in/out only)</option>
                            <option value="site">Site (full entry form)</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {activeTab === "payment" && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="s-bank">Bank name</label>
              <input id="s-bank" type="text" placeholder="Commonwealth Bank" value={s.bankName} onChange={e => f("bankName", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-bsb">BSB</label>
              <input id="s-bsb" type="text" placeholder="000-000" value={s.bsb} onChange={e => f("bsb", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-acc">Account number</label>
              <input id="s-acc" type="text" placeholder="1111 1111" value={s.accountNumber} onChange={e => f("accountNumber", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="s-notes">Invoice notes</label>
              {ta("s-notes", "invoiceNotes", "Additional notes shown at the bottom of each invoice")}
            </div>
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 18 }}>
          {isAdmin && activeTab === "rules" ? (
            <button className="btn-primary" onClick={() => onSaveWorkerRules?.(workerRules)}>
              <i className="ti ti-check" aria-hidden="true" /> Save Worker Rules
            </button>
          ) : isAdmin && activeTab === "company" ? (
            <button className="btn-primary" onClick={() => onSave(s)}>
              <i className="ti ti-check" aria-hidden="true" /> Save Company Info
            </button>
          ) : !isAdmin ? (
            <button className="btn-primary" onClick={() => onSave(s)}>
              <i className="ti ti-check" aria-hidden="true" /> Save Settings
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
});
