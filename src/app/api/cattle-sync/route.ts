import { NextRequest, NextResponse } from "next/server";
import type { CowChange } from "@/lib/cattle";

/**
 * Google Sheet <-> FarmLedger cattle sync. Called by the Apps Script in the
 * cow sheet (see the Cattle page for the script). Authenticated only by the
 * sync key in the Authorization header - no FarmLedger login - and it can
 * only read and write this farm's cattle list.
 *
 * Body: { changes: CowChange[] } - just the cells that changed in the sheet
 * since its last sync. Response: { cattle } - the full current list, which
 * the script writes back so website edits show up in the sheet.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.replace(/^Bearer\s+/i, "").trim();
  if (!key) return NextResponse.json({ error: "Missing sync key." }, { status: 401 });

  const { isSupabaseConfigured } = await import("@/lib/supabase/server");
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "FarmLedger isn't connected to its database." }, { status: 503 });

  let body: { changes?: CowChange[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Couldn't read the request." }, { status: 400 });
  }
  const changes = Array.isArray(body.changes) ? body.changes : [];

  try {
    const { cattleSyncWithKey } = await import("@/lib/supabase/repo");
    const result = await cattleSyncWithKey(key, changes);
    return NextResponse.json(result);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed." }, { status });
  }
}
