"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

function LoginForm() {
  const supabase     = createClient();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const urlError     = searchParams.get("error");

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/");
  };

  const bannerMessage =
    urlError === "not_invited"   ? "Access restricted. You need an invitation to use SplitShift." :
    urlError === "invalid_link"  ? "That invite link is invalid or has expired. Please request a new one." :
    null;

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
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 32 }}>
          Time &amp; earnings tracker
        </p>

        {bannerMessage && (
          <p style={{ fontSize: 13, color: "var(--color-text-danger)", marginBottom: 20, padding: "10px 12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", textAlign: "left" }}>
            {bannerMessage}
          </p>
        )}

        <form onSubmit={signInWithEmail} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
