/**
 * Minimal structured logger: one JSON object per line on stdout/stderr,
 * suitable for any log collector.  Never log document contents, passwords,
 * tokens or session identifiers.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = order[(process.env.LOG_LEVEL as Level) ?? "info"] ?? order.info;

function serialiseError(err: unknown) {
  if (err instanceof Error) {
    const e = err as Error & { code?: string };
    return { name: e.name, message: e.message, code: e.code, stack: e.stack?.split("\n").slice(0, 6).join("\n") };
  }
  return { message: String(err) };
}

function write(level: Level, msg: string, fields?: Fields) {
  if (order[level] < threshold || process.env.MSW_SILENT_LOGS === "1") return;
  const entry: Fields = { t: new Date().toISOString(), level, msg, ...fields };
  if (entry.err) entry.err = serialiseError(entry.err);
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, f?: Fields) => write("debug", msg, f),
  info: (msg: string, f?: Fields) => write("info", msg, f),
  warn: (msg: string, f?: Fields) => write("warn", msg, f),
  error: (msg: string, f?: Fields) => write("error", msg, f),
};
