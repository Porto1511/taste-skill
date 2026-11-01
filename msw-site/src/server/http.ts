import "server-only";
import { toUserMessage, UserError } from "./errors";

/** Reject cross-site POSTs to route handlers (defence in depth on top of SameSite cookies). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers may omit it
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function jsonError(err: unknown, context: string) {
  const status = err instanceof UserError ? err.status : (err as { code?: string })?.code === "42501" ? 403 : 400;
  return Response.json({ error: toUserMessage(err, context) }, { status: status >= 400 ? status : 400 });
}

export async function fileFrom(value: FormDataEntryValue | null): Promise<{ name: string; bytes: Buffer } | null> {
  if (!value || typeof value === "string" || value.size === 0) return null;
  return { name: value.name, bytes: Buffer.from(await value.arrayBuffer()) };
}
