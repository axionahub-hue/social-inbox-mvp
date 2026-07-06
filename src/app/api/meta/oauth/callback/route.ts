import { NextResponse } from "next/server";
import { verifyMetaOAuthState } from "@/lib/meta";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = verifyMetaOAuthState(url.searchParams.get("state"));

  if (error) {
    return NextResponse.redirect(`${appUrl}/?meta_oauth=error`);
  }

  if (!state) {
    return NextResponse.redirect(`${appUrl}/?meta_oauth=invalid_state`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?meta_oauth=missing_code`);
  }

  return NextResponse.redirect(
    `${appUrl}/?meta_oauth=code_received&workspace_id=${state.workspaceId}`,
  );
}
