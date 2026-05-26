import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { encryptField, decryptField } from "@/lib/encryption";
import { DEFAULT_SETTINGS } from "@/services/settings";
import type { Settings } from "@/types";

const SENSITIVE: (keyof Settings)[] = ["bsb", "accountNumber"];

function encryptSettings(s: Settings): Settings {
  const out = { ...s };
  for (const k of SENSITIVE) {
    const v = s[k];
    if (typeof v === "string") (out as Record<string, unknown>)[k] = encryptField(v);
  }
  return out;
}

function decryptSettings(s: Settings): Settings {
  const out = { ...s };
  for (const k of SENSITIVE) {
    const v = s[k];
    if (typeof v === "string") (out as Record<string, unknown>)[k] = decryptField(v);
  }
  return out;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { data } = await supabase
    .from("settings").select("*").eq("user_id", user.id).maybeSingle();
  if (!data) return NextResponse.json(null);

  const sd = data as { data: Settings; period_start: string; period_end: string };
  return NextResponse.json({
    settings:    decryptSettings({ ...DEFAULT_SETTINGS, ...(sd.data ?? {}) }),
    periodStart: sd.period_start ?? "",
    periodEnd:   sd.period_end   ?? "",
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { settings, periodStart, periodEnd } = await request.json() as {
    settings: Settings; periodStart: string; periodEnd: string;
  };

  const { error } = await supabase.from("settings").upsert({
    user_id:      user.id,
    data:         encryptSettings(settings),
    period_start: periodStart || null,
    period_end:   periodEnd   || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
