import { NextResponse } from "next/server";
import { processQueuedInboxActions } from "@/lib/inbox-action-queue";

export async function POST() {
  const result = await processQueuedInboxActions({ limit: 10 });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
