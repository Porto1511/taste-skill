import type { Driver } from "../db/types";
import { hashPassword } from "../auth/passwords";
import type { CreateAuthUser } from "./seed";

/** Demo mode: create auth users and credentials in the local shim tables. */
export function localAuthUserFactory(driver: Driver): CreateAuthUser {
  const hashes = new Map<string, Promise<string>>();
  return async ({ id, email, password }) => {
    if (!hashes.has(password)) hashes.set(password, hashPassword(password));
    const hash = await hashes.get(password)!;
    await driver.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
    await driver.query("insert into local_auth.credentials (user_id, password_hash) values ($1, $2)", [id, hash]);
    return id;
  };
}
