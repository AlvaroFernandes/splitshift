import React, { useState } from "react";
import type { ManagedUser, Settings } from "@/types";
import { Bdg } from "./ui";

type Role = "user" | "admin" | "viewer";

export interface WorkerRuleUpdate {
  userId: string;
  tfnLimit: number;
  limitPeriod: "week" | "month"; // "month" only for Hour Bank workers
  tfnRate: string;
  overtimeThreshold: number;
  excessMode: "abn" | "bank";
  workerType: "office" | "site";
}

type Rules = Omit<WorkerRuleUpdate, "userId">;

interface Draft {
  name: string;
  email: string;
  teamAccess: boolean; // workers only — accountant access
}

const selectStyle: React.CSSProperties = {
  padding: "7px 10px", fontSize: 13,
  border: "0.5px solid var(--color-border-secondary)",
  borderRadius: "var(--border-radius-md)",
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)",
};

const smallBtn: React.CSSProperties = { fontSize: 11, padding: "3px 9px" };

const ruleSelectStyle: React.CSSProperties = { ...selectStyle, padding: "4px 8px", fontSize: 12, width: "100%" };

// Admin's team: invite people, set each worker's work rules, edit details,
// and remove or restore access. Removing never deletes data — the person can
// no longer sign in, but every entry, invoice and bank record is kept.
export const TeamPage = React.memo(function TeamPage({ users, admins, viewers, workerSettings, onInvite, onResendInvite, onUpdateMember, onSaveWorkerRules, onSetRemoved }: {
  users: ManagedUser[];
  admins: ManagedUser[];
  viewers: ManagedUser[];
  workerSettings: Record<string, Settings>;
  onInvite: (email: string, role: Role, name?: string) => void | Promise<void>;
  onResendInvite: (target: ManagedUser, role: Role) => void | Promise<void>;
  onUpdateMember: (target: ManagedUser, role: Role, changes: { name: string; email: string; teamAccess?: boolean }) => Promise<boolean>;
  onSaveWorkerRules: (rules: WorkerRuleUpdate[]) => void | Promise<void>;
  onSetRemoved: (target: ManagedUser, role: Role, removed: boolean) => void | Promise<void>;
}) {
  const [inviteName,    setInviteName]    = useState("");
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteRole,    setInviteRole]    = useState<Role>("user");
  const [inviteSending, setInviteSending] = useState(false);
  const [showRemoved,   setShowRemoved]   = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [draft,         setDraft]         = useState<Draft | null>(null);
  const [confirmId,     setConfirmId]     = useState<string | null>(null);
  const [busyId,        setBusyId]        = useState<string | null>(null);
  // Unsaved work-rule changes, per worker — saved together with one button.
  const [ruleEdits,     setRuleEdits]     = useState<Record<string, Partial<Rules>>>({});
  const [savingRules,   setSavingRules]   = useState(false);

  const savedRules = (id: string): Rules => {
    const ws = workerSettings[id];
    return {
      tfnLimit:          ws?.tfnLimit          ?? 30,
      limitPeriod:      (ws?.excessMode === "bank" && ws?.limitPeriod === "month" ? "month" : "week") as "week" | "month",
      tfnRate:           ws?.tfnRate           ?? "",
      overtimeThreshold: ws?.overtimeThreshold ?? 12,
      excessMode:       (ws?.excessMode        ?? "abn") as "abn" | "bank",
      workerType:       (ws?.workerType        ?? "site") as "office" | "site",
    };
  };
  const rulesFor = (id: string): Rules => ({ ...savedRules(id), ...ruleEdits[id] });
  const setRule = <K extends keyof Rules>(id: string, k: K, v: Rules[K]) =>
    setRuleEdits(prev => ({ ...prev, [id]: { ...prev[id], [k]: v } }));

  const changedRules = Object.keys(ruleEdits)
    .filter(id => {
      const before = savedRules(id), after = rulesFor(id);
      return (Object.keys(after) as (keyof Rules)[]).some(k => after[k] !== before[k]);
    })
    .map(id => ({ userId: id, ...rulesFor(id) }));

  const saveRules = async () => {
    if (changedRules.length === 0 || savingRules) return;
    setSavingRules(true);
    try {
      await onSaveWorkerRules(changedRules);
      setRuleEdits({});
    } finally {
      setSavingRules(false);
    }
  };

  const startEdit = (u: ManagedUser) => {
    setConfirmId(null);
    setEditingId(u.id);
    setDraft({ name: u.name, email: u.email, teamAccess: !!u.teamAccess });
  };
  const cancelEdit = () => { setEditingId(null); setDraft(null); };
  const d = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(prev => prev ? { ...prev, [k]: v } : prev);

  const saveEdit = async (u: ManagedUser, role: Role) => {
    if (!draft || busyId) return;
    const name  = draft.name.trim();
    const email = draft.email.trim().toLowerCase();
    if (!email) return;
    setBusyId(u.id);
    try {
      const accessChanged = role === "user" && draft.teamAccess !== !!u.teamAccess;
      if (name !== u.name || email !== u.email || accessChanged) {
        if (!await onUpdateMember(u, role, { name, email, ...(accessChanged ? { teamAccess: draft.teamAccess } : {}) })) return;
      }
      cancelEdit();
    } finally {
      setBusyId(null);
    }
  };

  const setRemoved = async (u: ManagedUser, role: Role, removed: boolean) => {
    if (busyId) return;
    setBusyId(u.id);
    try { await onSetRemoved(u, role, removed); } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const resend = async (u: ManagedUser, role: Role) => {
    if (busyId) return;
    setBusyId(u.id);
    try { await onResendInvite(u, role); } finally { setBusyId(null); }
  };

  // The team owner is never listed — `admins` still includes them so other
  // screens (e.g. the activity log) can show their name.
  const members = (list: ManagedUser[]) => list.filter(u => !u.isOwner);
  const removedCount = [...users, ...members(admins), ...viewers].filter(u => u.removedAt).length;
  const shown = (list: ManagedUser[]) => members(list).filter(u => showRemoved || !u.removedAt);

  const statusBadge = (u: ManagedUser) =>
    u.removedAt                ? <Bdg type="danger">Removed</Bdg> :
    u.status === "accepted"    ? <Bdg type="tfn">Active</Bdg> :
    u.status === "expired"     ? <Bdg type="danger">Invite expired</Bdg> :
                                 <Bdg type="ot">Invite pending</Bdg>;

  const actions = (u: ManagedUser, role: Role) => {
    const busy = busyId === u.id;
    if (u.removedAt) {
      return (
        <button type="button" className="btn-secondary" style={smallBtn} disabled={busy} onClick={() => setRemoved(u, role, false)}>
          <i className="ti ti-user-check" aria-hidden="true" /> {busy ? "Restoring…" : "Restore"}
        </button>
      );
    }
    if (confirmId === u.id) {
      return (
        <>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Remove access? Their history is kept.</span>
          <button type="button" className="btn-secondary" style={{ ...smallBtn, color: "var(--color-text-danger)" }} disabled={busy} onClick={() => setRemoved(u, role, true)}>
            {busy ? "Removing…" : "Remove"}
          </button>
          <button type="button" className="btn-secondary" style={smallBtn} disabled={busy} onClick={() => setConfirmId(null)}>Cancel</button>
        </>
      );
    }
    return (
      <>
        {u.status !== "accepted" && (
          <button type="button" className="btn-secondary" style={smallBtn} disabled={busy} onClick={() => resend(u, role)}>
            {busy ? "Sending…" : "Resend invite"}
          </button>
        )}
        <button type="button" className="icon-btn-sm" onClick={() => startEdit(u)} aria-label={`Edit ${u.name}`} title="Edit">
          <i className="ti ti-edit" aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn-sm danger" onClick={() => { cancelEdit(); setConfirmId(u.id); }} aria-label={`Remove ${u.name}`} title="Remove from team">
          <i className="ti ti-user-off" aria-hidden="true" />
        </button>
      </>
    );
  };

  const editRow = (u: ManagedUser, role: Role, colSpan: number) => draft && (
    <tr style={{ background: "var(--color-background-secondary)" }}>
      <td colSpan={colSpan}>
        <form
          className="form-grid"
          style={{ padding: "8px 0" }}
          onSubmit={e => { e.preventDefault(); saveEdit(u, role); }}
        >
          <div className="field">
            <label htmlFor={`t-name-${u.id}`}>Name</label>
            <input id={`t-name-${u.id}`} type="text" value={draft.name} onChange={e => d("name", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`t-email-${u.id}`}>Email (used to sign in)</label>
            <input id={`t-email-${u.id}`} type="email" required value={draft.email} onChange={e => d("email", e.target.value)} />
          </div>
          {role === "user" && (
            <div className="field full">
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={draft.teamAccess} onChange={e => d("teamAccess", e.target.checked)} />
                Accountant access
              </label>
              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                Keeps logging their own hours, and can also see every worker&apos;s weekly report and saved invoices (read-only).
              </span>
            </div>
          )}
          <div className="field full" style={{ flexDirection: "row", gap: 8 }}>
            <button type="submit" className="btn-primary" disabled={busyId === u.id}>
              <i className="ti ti-check" aria-hidden="true" /> {busyId === u.id ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancel</button>
          </div>
        </form>
      </td>
    </tr>
  );

  // "ABN only" isn't stored separately: it's ABN mode with a TFN limit of 0,
  // so every hour goes on the invoice.
  type Arrangement = "abn" | "bank" | "abnOnly";
  const arrangementOf = (r: Rules): Arrangement =>
    r.excessMode === "abn" && r.tfnLimit === 0 ? "abnOnly" : r.excessMode;
  const setArrangement = (id: string, a: Arrangement) => {
    const r = rulesFor(id);
    const tfnLimit = a === "abnOnly" ? 0 : r.tfnLimit === 0 ? savedLimitOr30(id) : r.tfnLimit;
    setRuleEdits(prev => ({
      ...prev,
      [id]: {
        ...prev[id], excessMode: a === "bank" ? "bank" : "abn", tfnLimit,
        // Monthly limits are Hour Bank only — ABN invoices are weekly.
        ...(a !== "bank" ? { limitPeriod: "week" as const } : {}),
        ...(a === "abnOnly" ? { tfnRate: "" } : {}),
      },
    }));
  };
  const savedLimitOr30 = (id: string) => savedRules(id).tfnLimit || 30;

  const ruleCells = (u: ManagedUser) => {
    const r = rulesFor(u.id);
    const off = !!u.removedAt;
    const abnOnly = arrangementOf(r) === "abnOnly";
    return (
      <>
        <td>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="number" min="0" step="0.5" value={r.tfnLimit} disabled={off || abnOnly}
              onChange={e => setRule(u.id, "tfnLimit", parseFloat(e.target.value) || 0)}
              style={{ width: 70 }} aria-label={`TFN hour limit for ${u.name}`} />
            {r.excessMode === "bank" ? (
              <select value={r.limitPeriod} disabled={off} style={ruleSelectStyle}
                onChange={e => setRule(u.id, "limitPeriod", e.target.value as "week" | "month")}
                aria-label={`TFN limit period for ${u.name}`}>
                <option value="week">/ week</option>
                <option value="month">/ month</option>
              </select>
            ) : <span className="muted" style={{ fontSize: 12 }}>/ week</span>}
          </span>
        </td>
        <td>
          <input type="number" min="0" step="0.01" placeholder={abnOnly ? "—" : "Entry rate"} value={r.tfnRate} disabled={off || abnOnly}
            onChange={e => setRule(u.id, "tfnRate", e.target.value)}
            style={{ width: 90 }} aria-label={`TFN hourly rate for ${u.name}`} />
        </td>
        <td>
          <input type="number" min="1" step="0.5" value={r.overtimeThreshold} disabled={off}
            onChange={e => setRule(u.id, "overtimeThreshold", parseFloat(e.target.value) || 12)}
            style={{ width: 70 }} aria-label={`Overtime threshold for ${u.name}`} />
        </td>
        <td>
          <select value={arrangementOf(r)} disabled={off} style={ruleSelectStyle}
            onChange={e => setArrangement(u.id, e.target.value as Arrangement)}
            aria-label={`Excess hours mode for ${u.name}`}>
            <option value="abn">ABN Invoice</option>
            <option value="bank">Hour Bank</option>
            <option value="abnOnly">ABN only (no TFN)</option>
          </select>
        </td>
        <td>
          {r.excessMode === "bank" ? (
            <select value={r.workerType} disabled={off} style={ruleSelectStyle}
              onChange={e => setRule(u.id, "workerType", e.target.value as "office" | "site")}
              aria-label={`Worker type for ${u.name}`}>
              <option value="site">Site</option>
              <option value="office">Office</option>
            </select>
          ) : <span className="muted">—</span>}
        </td>
      </>
    );
  };

  const section = (title: string, list: ManagedUser[], role: Role) => {
    const rows = shown(list);
    if (rows.length === 0) return null;
    const isWorkers = role === "user";
    const colSpan = isWorkers ? 8 : 4;
    return (
      <div className="card mt-3" style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", margin: 0 }}>{title}</p>
          {isWorkers && changedRules.length > 0 && (
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-secondary" style={smallBtn} disabled={savingRules} onClick={() => setRuleEdits({})}>Discard</button>
              <button type="button" className="btn-primary" disabled={savingRules} onClick={saveRules}>
                <i className="ti ti-check" aria-hidden="true" />
                {savingRules ? "Saving…" : `Save work rules (${changedRules.length})`}
              </button>
            </span>
          )}
        </div>
        {isWorkers && (
          <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 10 }}>
            Leave the TFN rate blank to pay TFN hours at each entry&apos;s own rate. Overtime is per shift. Hour Bank workers are either Site (full entry form) or Office (clock in/out only). ABN only workers invoice every hour (TFN limit 0). Hour Bank workers can have a weekly or a monthly limit.
          </p>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th>{isWorkers ? "Worker" : "Name"}</th>
              {isWorkers ? (
                <>
                  <th>TFN limit (hrs)</th>
                  <th>TFN rate (AUD/hr)</th>
                  <th>Overtime after (hrs)</th>
                  <th>Extra hours</th>
                  <th>Type</th>
                </>
              ) : <th>Email</th>}
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <React.Fragment key={u.id}>
                <tr style={{ opacity: u.removedAt ? 0.6 : 1 }}>
                  {isWorkers ? (
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {u.name}
                        {u.teamAccess && <span style={{ marginLeft: 6 }}><Bdg type="abn">Accountant</Bdg></span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{u.email}</div>
                    </td>
                  ) : (
                    <>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{u.email}</td>
                    </>
                  )}
                  {isWorkers && ruleCells(u)}
                  <td>{statusBadge(u)}</td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {actions(u, role)}
                    </span>
                  </td>
                </tr>
                {editingId === u.id && editRow(u, role, colSpan)}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const nothingShown = shown(users).length + shown(admins).length + shown(viewers).length === 0;

  return (
    <div>
      <h2 className="sr-only">Team</h2>

      <div className="card">
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
          Invite workers, co-admins or viewers. They get an email with a sign-in link and are linked to your team automatically.
        </p>
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!inviteEmail || inviteSending) return;
            setInviteSending(true);
            try { await onInvite(inviteEmail, inviteRole, inviteName); } finally {
              setInviteName("");
              setInviteEmail("");
              setInviteSending(false);
            }
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input type="text" placeholder="Name" value={inviteName} onChange={e => setInviteName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <input type="email" required placeholder="Email address" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)} style={selectStyle} aria-label="Role">
            <option value="user">Worker</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer (accountant)</option>
          </select>
          <button type="submit" className="btn-primary" disabled={inviteSending}>
            <i className="ti ti-send" aria-hidden="true" />
            {inviteSending ? "Sending…" : "Send invite"}
          </button>
        </form>
      </div>

      {removedCount > 0 && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer", width: "fit-content", marginTop: 16 }}>
          <input type="checkbox" checked={showRemoved} onChange={e => setShowRemoved(e.target.checked)} />
          Show removed ({removedCount})
        </label>
      )}

      {section("Workers", users, "user")}
      {section("Admins", admins, "admin")}
      {section("Viewers (accountants)", viewers, "viewer")}

      {nothingShown && (
        <div className="empty-state mt-4">
          <i className="ti ti-users" aria-hidden="true" style={{ fontSize: 36, color: "var(--color-text-tertiary)" }} />
          <p>No team members yet. Send your first invitation above.</p>
        </div>
      )}
    </div>
  );
});
