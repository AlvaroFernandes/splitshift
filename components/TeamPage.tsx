import React, { useState } from "react";
import type { ManagedUser, Settings } from "@/types";
import { Bdg } from "./ui";

type Role = "user" | "admin" | "viewer";

export interface WorkerRuleUpdate {
  userId: string;
  tfnLimit: number;
  tfnRate: string;
  overtimeThreshold: number;
  excessMode: "abn" | "bank";
  workerType: "office" | "site";
}

interface Draft extends Omit<WorkerRuleUpdate, "userId"> {
  name: string;
  email: string;
}

const selectStyle: React.CSSProperties = {
  padding: "7px 10px", fontSize: 13,
  border: "0.5px solid var(--color-border-secondary)",
  borderRadius: "var(--border-radius-md)",
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)",
};

const smallBtn: React.CSSProperties = { fontSize: 11, padding: "3px 9px" };

// Admin's team: invite people, edit their details (and a worker's work rules),
// and remove or restore access. Removing never deletes data — the person can
// no longer sign in, but every entry, invoice and bank record is kept.
export const TeamPage = React.memo(function TeamPage({ users, admins, viewers, workerSettings, onInvite, onResendInvite, onUpdateMember, onSaveWorkerRules, onSetRemoved }: {
  users: ManagedUser[];
  admins: ManagedUser[];
  viewers: ManagedUser[];
  workerSettings: Record<string, Settings>;
  onInvite: (email: string, role: Role, name?: string) => void | Promise<void>;
  onResendInvite: (target: ManagedUser, role: Role) => void | Promise<void>;
  onUpdateMember: (target: ManagedUser, role: Role, changes: { name: string; email: string }) => Promise<boolean>;
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

  const rulesFor = (id: string) => {
    const ws = workerSettings[id];
    return {
      tfnLimit:          ws?.tfnLimit          ?? 30,
      tfnRate:           ws?.tfnRate           ?? "",
      overtimeThreshold: ws?.overtimeThreshold ?? 12,
      excessMode:       (ws?.excessMode        ?? "abn") as "abn" | "bank",
      workerType:       (ws?.workerType        ?? "site") as "office" | "site",
    };
  };

  const startEdit = (u: ManagedUser) => {
    setConfirmId(null);
    setEditingId(u.id);
    setDraft({ name: u.name, email: u.email, ...rulesFor(u.id) });
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
      if (name !== u.name || email !== u.email) {
        if (!await onUpdateMember(u, role, { name, email })) return;
      }
      if (role === "user") {
        const before = rulesFor(u.id);
        const after  = {
          tfnLimit: draft.tfnLimit, tfnRate: draft.tfnRate, overtimeThreshold: draft.overtimeThreshold,
          excessMode: draft.excessMode, workerType: draft.workerType,
        };
        if ((Object.keys(after) as (keyof typeof after)[]).some(k => after[k] !== before[k])) {
          await onSaveWorkerRules([{ userId: u.id, ...after }]);
        }
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

  const removedCount = [...users, ...admins, ...viewers].filter(u => u.removedAt).length;
  const shown = (list: ManagedUser[]) => showRemoved ? list : list.filter(u => !u.removedAt);

  const statusBadge = (u: ManagedUser) =>
    u.removedAt                ? <Bdg type="danger">Removed</Bdg> :
    u.status === "accepted"    ? <Bdg type="tfn">Active</Bdg> :
    u.status === "expired"     ? <Bdg type="danger">Invite expired</Bdg> :
                                 <Bdg type="ot">Invite pending</Bdg>;

  const ruleSummary = (id: string) => {
    const r = rulesFor(id);
    return r.excessMode === "bank"
      ? `Hour Bank · ${r.workerType === "office" ? "Office" : "Site"}`
      : "ABN invoice";
  };

  const actions = (u: ManagedUser, role: Role) => {
    const busy = busyId === u.id;
    // The team owner can't be edited or removed from here.
    if (u.isOwner) return null;
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
            <>
              <div className="field">
                <label htmlFor={`t-mode-${u.id}`}>Extra hours go to</label>
                <select id={`t-mode-${u.id}`} style={selectStyle} value={draft.excessMode} onChange={e => d("excessMode", e.target.value as "abn" | "bank")}>
                  <option value="abn">ABN Invoice</option>
                  <option value="bank">Hour Bank</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`t-type-${u.id}`}>Worker type</label>
                <select id={`t-type-${u.id}`} style={selectStyle} value={draft.workerType} disabled={draft.excessMode !== "bank"} onChange={e => d("workerType", e.target.value as "office" | "site")}>
                  <option value="site">Site (full entry form)</option>
                  <option value="office">Office (clock in/out only)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`t-limit-${u.id}`}>Weekly TFN limit (hrs)</label>
                <input id={`t-limit-${u.id}`} type="number" min="0" step="0.5" value={draft.tfnLimit} onChange={e => d("tfnLimit", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="field">
                <label htmlFor={`t-rate-${u.id}`}>TFN hourly rate (AUD)</label>
                <input id={`t-rate-${u.id}`} type="number" min="0" step="0.01" placeholder="Entry rate" value={draft.tfnRate} onChange={e => d("tfnRate", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`t-ot-${u.id}`}>Overtime after (hrs / shift)</label>
                <input id={`t-ot-${u.id}`} type="number" min="1" step="0.5" value={draft.overtimeThreshold} onChange={e => d("overtimeThreshold", parseFloat(e.target.value) || 12)} />
              </div>
            </>
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

  const section = (title: string, list: ManagedUser[], role: Role) => {
    const rows = shown(list);
    if (rows.length === 0) return null;
    const colSpan = role === "user" ? 5 : 4;
    return (
      <div className="card mt-3" style={{ overflowX: "auto" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8 }}>{title}</p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th>
              {role === "user" && <th>Work rules</th>}
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <React.Fragment key={u.id}>
                <tr style={{ opacity: u.removedAt ? 0.6 : 1 }}>
                  <td style={{ fontWeight: 500 }}>
                    {u.name}
                    {u.isOwner && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-text-tertiary)", fontWeight: 400 }}>Owner</span>}
                  </td>
                  <td style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{u.email}</td>
                  {role === "user" && <td style={{ fontSize: 12 }}>{ruleSummary(u.id)}</td>}
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
