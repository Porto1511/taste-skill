import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 32;

/** scrypt password hash: "scrypt$N$r$p$salt$hash" (base64url parts). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, rr, pp, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length, {
    N: Number(n), r: Number(rr), p: Number(pp), maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Readable one-time password for invited users in demo mode, e.g. "Deck-7342-Bolt". */
export function generateTemporaryPassword(): string {
  const words = ["Deck", "Bolt", "Stud", "Trim", "Beam", "Pour", "Grid", "Span", "Hoist", "Level", "Crane", "Rebar"];
  const pick = () => words[randomBytes(1)[0] % words.length];
  const num = (randomBytes(2).readUInt16BE(0) % 9000) + 1000;
  return `${pick()}-${num}-${pick()}`;
}

export const PASSWORD_RULES = "At least 10 characters.";
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (pw.length > 200) return "Password is too long.";
  return null;
}
