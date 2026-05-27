"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

function ConfirmHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const rawNext = searchParams.get("next") ?? "/";
    const next =
      rawNext.startsWith("/") &&
      !rawNext.startsWith("//") &&
      !rawNext.includes("://")
        ? rawNext
        : "/";

    let redirected = false;
    const doRedirect = (path: string) => {
      if (redirected) return;
      redirected = true;
      router.replace(path);
    };

    // 1. PKCE – token_hash + type in query params (password reset emails)
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    if (token_hash && type) {
      supabase.auth
        .verifyOtp({ token_hash, type: type as "invite" | "signup" | "recovery" | "email" })
        .then(({ error }) =>
          error
            ? doRedirect("/login?error=invalid_link")
            : doRedirect(type === "recovery" ? "/reset-password" : next),
        );
      return;
    }

    // 2. PKCE – code in query params (invite emails when PKCE is enabled)
    const code = searchParams.get("code");
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) =>
          error ? doRedirect("/login?error=invalid_link") : doRedirect(next),
        );
      return;
    }

    // 3. Implicit flow – access_token + refresh_token in the URL hash.
    //    @supabase/ssr does not reliably auto-parse hashes, so read it manually.
    const hash = window.location.hash.slice(1);
    const hp = new URLSearchParams(hash);
    const access_token = hp.get("access_token");
    const refresh_token = hp.get("refresh_token");
    const hashType = hp.get("type");

    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ data, error }) => {
          if (error || !data.session) return doRedirect("/login?error=invalid_link");
          doRedirect(hashType === "recovery" ? "/reset-password" : next);
        });
      return;
    }

    // 4. Fallback – let the Supabase client auto-detect whatever it can
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && ["SIGNED_IN", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) {
        doRedirect(event === "PASSWORD_RECOVERY" ? "/reset-password" : next);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) doRedirect(next);
    });

    const fallback = setTimeout(() => doRedirect("/login?error=invalid_link"), 8000);
    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        color: "#71717a",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          border: "3px solid #e4e4e7",
          borderTopColor: "#d97706",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ margin: 0, fontSize: "15px" }}>Verifying your link…</p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <ConfirmHandler />
    </Suspense>
  );
}
