import { NextResponse } from "next/server";
import { isMetaConfigured } from "@/lib/meta";
import { hasSupabaseConfig } from "@/lib/supabase";

export async function GET() {
  return NextResponse.json({
    ok: true,
    services: {
      supabase: hasSupabaseConfig ? "configured" : "demo",
      meta: isMetaConfigured() ? "configured" : "demo",
    },
  });
}
