"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSubmitted(true);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-background-tertiary)",
    }}>
      <div style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "40px 48px",
        width: 360,
        textAlign: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <i className="ti ti-briefcase" style={{ fontSize: 24, color: "var(--color-text-warning)" }} />
          <span style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text-primary)" }}>SplitShift</span>
        </div>

        {submitted ? (
          <>
            <p style={{ fontSize: 14, color: "var(--color-text-primary)", margin: "24px 0 8px", fontWeight: 500 }}>
              Check your email
            </p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 24px" }}>
              If <strong>{email}</strong> has an account, you'll receive a password reset link shortly.
            </p>
            <a href="/login" style={{ fontSize: 13, color: "var(--color-text-warning)", textDecoration: "none" }}>
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 28px" }}>
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 14,
                  background: "var(--color-background-secondary)",
                  border: "0.5px solid var(--color-border-secondary)",
                  borderRadius: "var(--border-radius-md)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {error && (
                <p style={{ fontSize: 12, color: "var(--color-text-danger)", margin: 0, textAlign: "left" }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: "var(--color-text-warning)",
                  border: "none",
                  borderRadius: "var(--border-radius-md)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <a href="/login" style={{ display: "block", marginTop: 20, fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none" }}>
              Back to sign in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
