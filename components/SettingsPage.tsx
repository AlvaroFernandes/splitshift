import React, { useState, useEffect } from "react";
import type { EntryTemplate, Settings } from "@/types";
import { DEFAULT_SETTINGS } from "@/services/settings";
import { createClient } from "@/lib/supabase";

interface Props {
  settings: Settings;
  onSave: (s: Settings) => void;
  isAdmin?: boolean;
}

export const SettingsPage = React.memo(function SettingsPage({ settings, onSave, isAdmin }: Props) {
  const [s, setS] = useState<Settings>({ ...DEFAULT_SETTINGS, ...settings });
  const [newPwd,         setNewPwd]         = useState("");
  const [confirmPwd,     setConfirmPwd]     = useState("");
  const [pwdLoading,     setPwdLoading]     = useState(false);
  const [pwdMsg,         setPwdMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  const defaultTab = isAdmin ? "company" : "personal";
  const [activeTab, setActiveTab] = useState<"personal" | "payment" | "company">(defaultTab as "personal" | "payment" | "company");

  const f = (k: keyof Settings, v: string | number) => setS(prev => ({ ...prev, [k]: v }));

  useEffect(() => { setS({ ...DEFAULT_SETTINGS, ...settings }); }, [settings]);

  const STABS = [
    ...(isAdmin ? [] : [{ id: "personal" as const, label: "Personal",   icon: "ti-user"        }]),
    ...(isAdmin ? [{ id: "company" as const, label: "Company",    icon: "ti-building"    }] : []),
    ...(isAdmin ? [] : [{ id: "payment"  as const, label: "Payment",    icon: "ti-credit-card" }]),
  ];

  const ta = (id: string, key: keyof Settings, placeholder: string, rows = 3) => (
    <textarea
      id={id} rows={rows} placeholder={placeholder}
      value={s[key] as string} onChange={e => f(key, e.target.value)}
      style={{ resize: "vertical", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "7px 10px", fontSize: 13, fontFamily: "inherit" }}
    />
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
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
              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                Shown in the app and sent by email (then once a week while you still haven&apos;t logged).
              </span>
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
          {isAdmin && activeTab === "company" ? (
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
