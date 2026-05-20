import React, { useMemo, useState } from "react";
import type { ProcessedEntry } from "@/types";
import { weekStart } from "@/lib/calculations";

function barLabel(key: string, view: "week" | "month"): { line1: string; line2: string } {
  const d = new Date(key + "T00:00:00");
  if (view === "month") {
    return {
      line1: d.toLocaleDateString("en-AU", { month: "short" }),
      line2: String(d.getFullYear()),
    };
  }
  return {
    line1: d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
    line2: String(d.getFullYear()),
  };
}

function compact(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export const EarningsChart = React.memo(function EarningsChart({ processed, isAdmin }: {
  processed: ProcessedEntry[];
  isAdmin?: boolean;
}) {
  const [view, setView] = useState<"week" | "month">("week");

  const bars = useMemo(() => {
    const map: Record<string, { tfn: number; abn: number; total: number }> = {};
    for (const e of processed) {
      const key = view === "week" ? weekStart(e.date) : e.date.slice(0, 7);
      if (!map[key]) map[key] = { tfn: 0, abn: 0, total: 0 };
      map[key].tfn   += e.tfnEarnings;
      map[key].abn   += e.abnEarnings;
      map[key].total += e.totalEarnings;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, ...barLabel(key, view), ...v }));
  }, [processed, view]);

  if (bars.length === 0) return null;

  const maxTotal    = Math.max(...bars.map(b => b.total), 1);
  const FILL_OPACITY = 0.75;
  const BAR_W   = 42;
  const GAP     = 6;
  const CHART_H = 120;
  const LABEL_H = 26;
  const svgW    = bars.length * (BAR_W + GAP) - GAP;

  return (
    <div className="card mt-4">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>Earnings trend</p>
        <div style={{ display: "flex", gap: 4 }}>
          {(["week", "month"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontSize: 11, padding: "2px 9px",
                borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-secondary)",
                background: view === v ? "var(--color-text-warning)" : "var(--color-background-secondary)",
                color: view === v ? "#fff" : "var(--color-text-secondary)",
                cursor: "pointer",
              }}
            >
              {v === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg
          width={Math.max(svgW, 280)}
          height={CHART_H + LABEL_H}
          style={{ display: "block", overflow: "visible" }}
          role="img"
          aria-label="Earnings trend bar chart"
        >
          {bars.map((b, i) => {
            const x      = i * (BAR_W + GAP);
            const totalH = Math.max(2, (b.total / maxTotal) * CHART_H);
            const tfnH   = isAdmin ? 0 : Math.max(0, (b.tfn / maxTotal) * CHART_H);
            const abnH   = isAdmin ? 0 : Math.max(0, (b.abn / maxTotal) * CHART_H);
            const labelY = CHART_H - totalH - 5;

            return (
              <g key={b.key}>
                {isAdmin ? (
                  <rect x={x} y={CHART_H - totalH} width={BAR_W} height={totalH} rx={3}
                    fill="var(--color-text-success)" fillOpacity={FILL_OPACITY} />
                ) : (
                  <>
                    {tfnH > 0 && (
                      <rect x={x} y={CHART_H - tfnH} width={BAR_W} height={tfnH}
                        rx={abnH > 0 ? 0 : 3}
                        fill="var(--color-text-success)" fillOpacity={FILL_OPACITY} />
                    )}
                    {abnH > 0 && (
                      <rect x={x} y={CHART_H - tfnH - abnH} width={BAR_W} height={abnH} rx={3}
                        fill="var(--color-text-info)" fillOpacity={FILL_OPACITY} />
                    )}
                    {totalH <= 2 && (
                      <rect x={x} y={CHART_H - 2} width={BAR_W} height={2} rx={1}
                        fill="var(--color-border-secondary)" />
                    )}
                  </>
                )}

                {b.total > 0 && (
                  <text x={x + BAR_W / 2} y={labelY} textAnchor="middle" fontSize={9}
                    style={{ fill: "var(--color-text-secondary)" }}>
                    {compact(b.total)}
                  </text>
                )}

                <text x={x + BAR_W / 2} y={CHART_H + 11} textAnchor="middle" fontSize={9}
                  style={{ fill: "var(--color-text-tertiary)" }}>
                  {b.line1}
                </text>
                <text x={x + BAR_W / 2} y={CHART_H + 23} textAnchor="middle" fontSize={9}
                  style={{ fill: "var(--color-text-tertiary)" }}>
                  {b.line2}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {!isAdmin && (
        <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: "var(--color-text-secondary)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "var(--color-text-success)", opacity: FILL_OPACITY }} />
            TFN
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "var(--color-text-info)", opacity: FILL_OPACITY }} />
            ABN
          </span>
        </div>
      )}
    </div>
  );
});
