import { getDriver } from "@/server/db";
import { config } from "@/server/config";

export async function GET() {
  try {
    const db = await getDriver();
    await db.query("select 1");
    return Response.json({ ok: true, mode: config.mode });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
