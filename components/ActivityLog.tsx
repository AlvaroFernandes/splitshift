import React from "react";
import type { AuditEntry } from "@/types";

function timeAgo(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1)  return "yesterday";
  if (diffD < 7)    return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

type ActionDef = { icon: string; color: string; label: (meta: Record<string, unknown>) => string };

const ACTION_DEFS: Record<string, ActionDef> = {
  entry_edited: {
    icon:  "ti-edit",
    color: "var(--color-text-info)",
    label: m => `Edited ${m.workerName ?? "worker"}'s entry on ${m.entryDate ?? "—"}${m.jobDescription ? ` · ${m.jobDescription}` : ""}`,
  },
  entry_deleted: {
    icon:  "ti-trash",
    color: "var(--color-text-danger)",
    label: m => `Deleted ${m.workerName ?? "worker"}'s entry on ${m.entryDate ?? "—"}${m.jobDescription ? ` · ${m.jobDescription}` : ""}`,
  },
  invite_sent: {
    icon:  "ti-send",
    color: "var(--color-text-success)",
    label: m => `Invited ${m.email ?? "user"} as ${m.role ?? "worker"}`,
  },
  worker_rules_saved: {
    icon:  "ti-adjustments",
    color: "var(--color-text-warning)",
    label: m => `Updated work rules for ${m.workerCount ?? 0} worker${Number(m.workerCount) !== 1 ? "s" : ""}`,
  },
  worker_mode_changed: {
    icon:  "ti-arrows-exchange",
    color: "var(--color-text-bank)",
    label: m => `Switched ${m.workerName ?? "worker"} from ${m.from === "bank" ? "Hour Bank" : "ABN"} to ${m.to === "bank" ? "Hour Bank" : "ABN"}`,
  },
};

function ActionIcon({ action, color }: { action: string; color: string }) {
  const def = ACTION_DEFS[action];
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--color-background-tertiary)",
    }}>
      <i className={`ti ${def?.icon ?? "ti-circle"}`} style={{ fontSize: 15, color }} aria-hidden="true" />
    </div>
  );
}

export function ActivityLog({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <i className="ti ti-activity" aria-hidden="true" style={{ fontSize: 36, color: "var(--color-text-tertiary)" }} />
        <p>No activity yet. Actions like editing worker entries, sending invites, and saving work rules will appear here.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "0 16px" }}>
      {entries.map((e, i) => {
        const def   = ACTION_DEFS[e.action];
        const color = def?.color ?? "var(--color-text-secondary)";
        const label = def?.label(e.meta) ?? e.action;
        return (
          <div
            key={e.id}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "13px 0",
              borderBottom: i < entries.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none",
            }}
          >
            <ActionIcon action={e.action} color={color} />
            <span style={{ flex: 1, fontSize: 13, color: "var(--color-text-primary)", minWidth: 0 }}>
              {label}
            </span>
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", flexShrink: 0, whiteSpace: "nowrap" }}>
              {timeAgo(e.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
