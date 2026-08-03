import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { syncAll, getLastSyncLog } from "@/lib/sheet-sync";
import { isGoogleSheetsConfigured } from "@/lib/google-sheets";

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const last = await getLastSyncLog();
  return NextResponse.json({
    configured: isGoogleSheetsConfigured(),
    lastSync: last
      ? {
          id: last.id,
          direction: last.direction,
          pulled: last.pulled,
          pushed: last.pushed,
          created: last.created,
          updated: last.updated,
          conflicts: last.conflicts,
          errors: last.errorsJson ? JSON.parse(last.errorsJson) : [],
          notes: last.notesJson ? JSON.parse(last.notesJson) : {},
          createdAt: last.createdAt,
          userName: last.user?.name ?? null,
        }
      : null,
  });
}

export async function POST() {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAll({ userId: session.uid, direction: "BOTH" });
  return NextResponse.json({
    ok: result.errors.length === 0,
    ...result,
  });
}
