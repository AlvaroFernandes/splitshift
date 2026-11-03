import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Sets the signed-in user's password. Runs server-side because the browser
// client's session can go missing (e.g. after a failed token refresh) while
// the cookie session the proxy validates is still good — and an invited user
// with no password yet can't sign back in to retry.
//
// Uses the user's own cookie session rather than the admin API: an admin
// password update signs the user out of every session, including this one,
// so anything saved afterwards (e.g. the rest of onboarding) would fail.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Your session has expired. Use \"Forgot password\" on the login page to set one." }, { status: 401 });
  }

  const { password } = await request.json() as { password?: string };
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
