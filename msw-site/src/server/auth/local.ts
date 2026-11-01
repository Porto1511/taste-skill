import "server-only";
import { withSystem } from "../db";
import { randomToken, sha256, verifyPassword, hashPassword } from "./passwords";

export const SESSION_COOKIE = "msw_session";
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// A real hash of a random value, so unknown emails cost the same time to check.
const dummyHash = hashPassword(randomToken());

/** Demo mode: verify email + password against the local credential store. */
export async function verifyLocalCredentials(email: string, password: string): Promise<string | null> {
  const rows = await withSystem(async (tx) =>
    (
      await tx.query<{ id: string; password_hash: string; active: boolean }>(
        `select u.id, c.password_hash, coalesce(p.active, false) as active
         from auth.users u
         join local_auth.credentials c on c.user_id = u.id
         left join public.profiles p on p.id = u.id
         where lower(u.email) = lower($1)`,
        [email.trim()],
      )
    ).rows,
  );
  const row = rows[0];
  const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
  if (!row || !ok || !row.active) return null;
  return row.id;
}

export async function createLocalSession(userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await withSystem((tx) =>
    tx.query("insert into local_auth.sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
      sha256(token), userId, expires.toISOString(),
    ]),
  );
  return { token, expires };
}

export async function resolveLocalSession(token: string): Promise<string | null> {
  const { rows } = await withSystem((tx) =>
    tx.query<{ user_id: string }>(
      "select user_id from local_auth.sessions where token_hash = $1 and expires_at > now()",
      [sha256(token)],
    ),
  );
  return rows[0]?.user_id ?? null;
}

export async function destroyLocalSession(token: string) {
  await withSystem((tx) => tx.query("delete from local_auth.sessions where token_hash = $1", [sha256(token)]));
}

export async function destroyAllLocalSessions(userId: string) {
  await withSystem((tx) => tx.query("delete from local_auth.sessions where user_id = $1", [userId]));
}

export async function setLocalPassword(userId: string, password: string) {
  const hash = await hashPassword(password);
  await withSystem((tx) =>
    tx.query(
      `insert into local_auth.credentials (user_id, password_hash) values ($1, $2)
       on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
      [userId, hash],
    ),
  );
}

export async function checkLocalPassword(userId: string, password: string): Promise<boolean> {
  const { rows } = await withSystem((tx) =>
    tx.query<{ password_hash: string }>("select password_hash from local_auth.credentials where user_id = $1", [userId]),
  );
  return rows[0] ? verifyPassword(password, rows[0].password_hash) : false;
}

/** Demo mode: create the auth identity for an invited user. */
export async function createLocalAuthUser(id: string, email: string, password: string) {
  await withSystem((tx) => tx.query("insert into auth.users (id, email) values ($1, $2)", [id, email.toLowerCase()]));
  await setLocalPassword(id, password);
}

export async function deleteLocalAuthUser(id: string) {
  await withSystem((tx) => tx.query("delete from auth.users where id = $1", [id]));
}
