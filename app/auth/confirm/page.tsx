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
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    let redirected = false;
    const doRedirect = (path: string) => {
      if (redirected) return;
      redirected = true;
      router.replace(path);
    };

    // PKCE flow (password reset) — token_hash is in the query string
    if (token_hash && type) {
      supabase.auth
        .verifyOtp({
          token_hash,
          type: type as "invite" | "signup" | "recovery" | "email",
        })
        .then(({ error }) =>
          error
            ? doRedirect("/login?error=invalid_link")
            : doRedirect(type === "recovery" ? "/reset-password" : next),
        );
      return;
    }

    // Implicit flow (invite) — session arrives in the URL hash; the Supabase
    // browser client parses it automatically and fires onAuthStateChange.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        ["SIGNED_IN", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)
      ) {
        doRedirect(event === "PASSWORD_RECOVERY" ? "/reset-password" : next);
      }
    });

    // In case the session was already parsed before the listener attached
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) doRedirect(next);
    });

    // Give up after 8 s if no session materialises
    const fallback = setTimeout(
      () => doRedirect("/login?error=invalid_link"),
      8000,
    );

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
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
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
