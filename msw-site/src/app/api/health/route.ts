import { getDriver } from "@/server/db";
import { config } from "@/server/config";
import { log } from "@/server/log";

export async function GET() {
  try {
    const db = await getDriver();
    await db.query("select 1");
    return Response.json({ ok: true, mode: config.mode });
  } catch (err) {
    log.error("health.failed", { err });
    return Response.json({ ok: false }, { status: 503 });
  }
}
