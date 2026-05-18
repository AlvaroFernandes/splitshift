"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", textAlign: "center", padding: 32 }}>
        <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 40, color: "var(--color-text-warning)", display: "block", marginBottom: 16 }} />
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong</p>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button className="btn-primary" onClick={reset} style={{ margin: "0 auto" }}>
          <i className="ti ti-refresh" aria-hidden="true" /> Try again
        </button>
      </div>
    </div>
  );
}
