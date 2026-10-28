import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const COMPANY_FIELDS = ["companyName", "companyAbn", "companyAddress", "companyEmail"] as const;

// The company info lives on the team owner's (root admin's) settings row.
// Admin (owner or co-admin) or worker/viewer → their team owner's info.
async function resolveTeamOwner() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({}, { status: 401 }) } as const;

  const { data: profile } = await supabase
    .from("profiles").select("role, admin_id").eq("user_id", user.id).maybeSingle();

  const p = profile as { role: string; admin_id: string | null } | null;
  const ownerId = p?.role === "admin" ? (p.admin_id ?? user.id) : (p?.admin_id ?? null);
  return { ownerId, isAdmin: p?.role === "admin" } as const;
}

export async function GET() {
  const auth = await resolveTeamOwner();
  if ("error" in auth) return auth.error;
  if (!auth.ownerId) return NextResponse.json({});

  const admin = createAdminClient();
  const { data } = await admin
    .from("settings").select("data").eq("user_id", auth.ownerId).maybeSingle();

  if (!data) return NextResponse.json({});

  const s = (data as { data: Record<string, unknown> }).data ?? {};
  return NextResponse.json({
    companyName:    (s.companyName    as string) || "",
    companyAbn:     (s.companyAbn     as string) || "",
    companyAddress: (s.companyAddress as string) || "",
    companyEmail:   (s.companyEmail   as string) || "",
  });
}

// Any admin on the team can update the shared company info. Only the company
// fields are merged into the owner's settings; everything else is untouched.
export async function POST(request: NextRequest) {
  const auth = await resolveTeamOwner();
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin || !auth.ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as Record<string, unknown>;
  const changes: Record<string, string> = {};
  for (const k of COMPANY_FIELDS) {
    if (typeof body[k] === "string") changes[k] = (body[k] as string).trim();
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("settings").select("data").eq("user_id", auth.ownerId).maybeSingle();
  const current = ((row as { data: Record<string, unknown> } | null)?.data) ?? {};

  const { error } = await admin.from("settings").upsert(
    { user_id: auth.ownerId, data: { ...current, ...changes } },
    { onConflict: "user_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
