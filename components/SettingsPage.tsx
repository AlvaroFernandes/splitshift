import React, { useState, useEffect } from "react";
import type { EntryTemplate, ManagedUser, Settings } from "@/types";
import { DEFAULT_SETTINGS } from "@/services/settings";

interface WorkerRule {
  userId: string;
  name: string;
  tfnLimit: number;
  overtimeThreshold: number;
}

interface Props {
  settings: Settings;
  onSave: (s: Settings) => void;
  isAdmin?: boolean;
  managedUsers?: ManagedUser[];
  managedAdmins?: ManagedUser[];
  managedViewers?: ManagedUser[];
  workerSettings?: Record<string, Settings>;
  onSaveWorkerRules?: (rules: { userId: string; tfnLimit: number; overtimeThreshold: number }[]) => void;
  onInvite?: (email: string, role: "user" | "admin" | "viewer") => void;
}

export const SettingsPage = React.memo(function SettingsPage({ settings, onSave, isAdmin, managedUsers, managedAdmins, managedViewers, workerSettings, onSaveWorkerRules, onInvite }: Props) {
  const [s, setS] = useState<Settings>({ ...DEFAULT_SETTINGS, ...settings });
  const [workerRules,    setWorkerRules]    = useState<WorkerRule[]>([]);
  const [inviteEmail,    setInviteEmail]    = useState("");
  const [inviteRole,     setInviteRole]     = useState<"user" | "admin" | "viewer">("user");
  const [inviteSending,  setInviteSending]  = useState(false);

  const defaultTab = isAdmin ? "rules" : "personal";
  const [activeTab, setActiveTab] = useState<"personal" | "company" | "rules" | "team" | "payment">(defaultTab as "personal" | "company" | "rules" | "team" | "payment");

  const f = (k: keyof Settings, v: string | number) => setS(prev => ({ ...prev, [k]: v }));

  useEffect(() => { setS({ ...DEFAULT_SETTINGS, ...settings }); }, [settings]);

  useEffect(() => {
    setWorkerRules(prev => {
      const next = (managedUsers ?? []).map(u => ({
        userId:            u.id,
        name:              u.name || u.email,
        tfnLimit:          workerSettings?.[u.id]?.tfnLimit          ?? 30,
        overtimeThreshold: workerSettings?.[u.id]?.overtimeThreshold ?? 12,
      }));
      if (prev.length === next.length &&
          prev.every((r, i) => r.userId === next[i].userId &&
                               r.tfnLimit === next[i].tfnLimit &&
                               r.overtimeThreshold === next[i].overtimeThreshold))
        return prev;
      return next;
    });
  }, [managedUsers, workerSettings]);

  const STABS = [
    ...(isAdmin ? [] : [{ id: "personal" as const, label: "Personal",   icon: "ti-user"        }]),
    ...(isAdmin ? [] : [{ id: "company"  as const, label: "Company",    icon: "ti-building"    }]),
    { id: "rules" as const, label: "Work Rules", icon: "ti-adjustments" },
    ...(isAdmin ? [{ id: "team" as const, label: "Team", icon: "ti-users" }] : []),
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

  return (
    <div style={{ maxWidth: 600 }}>
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
              <input id="s-tfnrate" type="number" min="0" step="0.01" placeholder="Same as entry rate" value={s.tfnRate} onChange={e => f("tfnRate", e.target.value)} />
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
          </div>
        )}

        {activeTab === "company" && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="s-cname">Company name</label>
              <input id="s-cname" type="text" value={s.companyName} onChange={e => f("companyName", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="s-cabn">Company ABN</label>
              <input id="s-cabn" type="text" placeholder="12 345 678 901" value={s.companyAbn} onChange={e => f("companyAbn", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="s-cemail">Company email</label>
              <input id="s-cemail" type="email" value={s.companyEmail} onChange={e => f("companyEmail", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="s-caddr">Company address</label>
              {ta("s-caddr", "companyAddress", "Street, City, State, Postcode")}
            </div>
          </div>
        )}

        {activeTab === "rules" && isAdmin && (
          <>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
              Set TFN hour limit and overtime threshold for each worker. These rules are applied independently per worker when calculating their hours and earnings.
            </p>
            {workerRules.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>No managed workers found.</p>
            ) : (
              <table className="data-table" style={{ marginBottom: 4 }}>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>TFN hour limit</th>
                    <th>Overtime after (hrs/day)</th>
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
                        <input
                          type="number" min="1" step="0.5"
                          value={r.overtimeThreshold}
                          onChange={e => updateRule(r.userId, "overtimeThreshold", parseFloat(e.target.value) || 12)}
                          style={{ width: 80 }}
                          aria-label={`Overtime threshold for ${r.name}`}
                        />
                        <span style={{ marginLeft: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>hrs</span>
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
              <input id="s-bsb" type="text" placeholder="062-028" value={s.bsb} onChange={e => f("bsb", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-acc">Account number</label>
              <input id="s-acc" type="text" placeholder="1144-0435" value={s.accountNumber} onChange={e => f("accountNumber", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="s-notes">Invoice notes</label>
              {ta("s-notes", "invoiceNotes", "Additional notes shown at the bottom of each invoice")}
            </div>
          </div>
        )}

        {activeTab === "team" && isAdmin && (
          <>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 20 }}>
              Invite workers or co-admins. They will receive an email with a sign-in link and automatically be linked to your team.
            </p>

            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!inviteEmail || inviteSending) return;
                setInviteSending(true);
                await onInvite?.(inviteEmail, inviteRole);
                setInviteEmail("");
                setInviteSending(false);
              }}
              style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}
            >
              <input
                type="email" required placeholder="colleague@example.com"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <select
                value={inviteRole} onChange={e => setInviteRole(e.target.value as "user" | "admin" | "viewer")}
                style={{
                  padding: "7px 10px", fontSize: 13,
                  border: "0.5px solid var(--color-border-secondary)",
                  borderRadius: "var(--border-radius-md)",
                  background: "var(--color-background-secondary)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value="user">Worker</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer (accountant)</option>
              </select>
              <button type="submit" className="btn-primary" disabled={inviteSending}>
                <i className="ti ti-send" aria-hidden="true" />
                {inviteSending ? "Sending…" : "Send invite"}
              </button>
            </form>

            {(managedAdmins ?? []).length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8 }}>Co-admins</p>
                <table className="data-table" style={{ marginBottom: 20 }}>
                  <thead><tr><th>Name</th><th>Email</th></tr></thead>
                  <tbody>
                    {(managedAdmins ?? []).map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.name}</td>
                        <td style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{a.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {(managedUsers ?? []).length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8 }}>Workers</p>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Email</th></tr></thead>
                  <tbody>
                    {(managedUsers ?? []).map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 500 }}>{u.name}</td>
                        <td style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{u.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {(managedViewers ?? []).length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8, marginTop: 20 }}>Viewers (accountants)</p>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Email</th></tr></thead>
                  <tbody>
                    {(managedViewers ?? []).map(v => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 500 }}>{v.name}</td>
                        <td style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{v.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {(managedUsers ?? []).length === 0 && (managedAdmins ?? []).length === 0 && (managedViewers ?? []).length === 0 && (
              <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>No team members yet. Send your first invitation above.</p>
            )}
          </>
        )}

        <div className="btn-row" style={{ marginTop: 18 }}>
          {activeTab === "rules" && isAdmin ? (
            <button className="btn-primary" onClick={() => onSaveWorkerRules?.(workerRules)}>
              <i className="ti ti-check" aria-hidden="true" /> Save Worker Rules
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
