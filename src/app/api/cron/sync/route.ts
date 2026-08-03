import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sheet-sync";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAll({ direction: "BOTH" });
  return NextResponse.json({
    ok: result.errors.length === 0,
    syncLogId: result.syncLogId,
    pulled: result.pulled,
    pushed: result.pushed,
    created: result.created,
    updated: result.updated,
    conflicts: result.conflicts,
    paymentsImported: result.paymentsImported,
    errors: result.errors,
  });
}
