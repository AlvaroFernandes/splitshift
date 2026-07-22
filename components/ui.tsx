import React from "react";

export const Metric = React.memo(function Metric({ label, value, sub, color, progress, bold }: {
  label: string; value: string; sub?: string;
  color?: "success" | "info" | "warning" | "danger";
  progress?: number; bold?: boolean;
}) {
  const colorVars: Record<string, string> = {
    success: "var(--color-text-success)",
    info:    "var(--color-text-info)",
    warning: "var(--color-text-warning)",
    danger:  "var(--color-text-danger)",
  };
  return (
    <div className="metric-card">
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: bold ? 20 : 18, fontWeight: 500, color: colorVars[color ?? ""] || "var(--color-text-primary)" }}>
        {value}
      </div>
      {sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
      {progress !== undefined && (
        <div style={{ height: 3, background: "var(--color-background-tertiary)", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: progress >= 100 ? "var(--color-background-danger)" : "var(--color-background-success)",
            borderRadius: 99,
            transition: "width 0.6s",
          }} />
        </div>
      )}
    </div>
  );
});

export const Bdg = React.memo(function Bdg({ type, children }: { type: "tfn" | "abn" | "ot" | "bank" | "danger"; children: React.ReactNode }) {
  const s: Record<string, React.CSSProperties> = {
    tfn:    { background: "var(--color-background-success)", color: "var(--color-text-success)" },
    abn:    { background: "var(--color-background-info)",    color: "var(--color-text-info)"    },
    ot:     { background: "var(--color-background-warning)", color: "var(--color-text-warning)" },
    bank:   { background: "var(--color-background-bank)",    color: "var(--color-text-bank)"    },
    danger: { background: "var(--color-background-danger)",  color: "var(--color-text-danger)"  },
  };
  return (
    <span style={{ ...s[type], fontSize: 11, padding: "2px 6px", borderRadius: 4, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
});
