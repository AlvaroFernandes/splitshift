import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, admin_id").eq("user_id", user.id).maybeSingle();

  const p = profile as { role: string; admin_id: string | null } | null;
  // Admin → return their own company info; worker/viewer → return their admin's info
  const targetId = p?.role === "admin" ? user.id : (p?.admin_id ?? null);
  if (!targetId) return NextResponse.json({});

  const admin = createAdminClient();
  const { data } = await admin
    .from("settings").select("data").eq("user_id", targetId).maybeSingle();

  if (!data) return NextResponse.json({});

  const s = (data as { data: Record<string, unknown> }).data ?? {};
  return NextResponse.json({
    companyName:    (s.companyName    as string) || "",
    companyAbn:     (s.companyAbn     as string) || "",
    companyAddress: (s.companyAddress as string) || "",
    companyEmail:   (s.companyEmail   as string) || "",
  });
}
