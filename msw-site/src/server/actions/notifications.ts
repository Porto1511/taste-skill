"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireViewer } from "../auth/viewer";
import { withUser } from "../db";
import { str } from "./helpers";

export async function markAllReadAction() {
  const viewer = await requireViewer();
  await withUser(viewer.id, (tx) => tx.query("update notifications set read_at = now() where user_id = auth.uid() and read_at is null"));
  refresh();
}

export async function openNotificationAction(f: FormData) {
  const viewer = await requireViewer();
  const id = z.string().uuid().parse(str(f, "id"));
  const href = await withUser(viewer.id, async (tx) =>
    (await tx.query<{ href: string | null }>(
      "update notifications set read_at = coalesce(read_at, now()) where id = $1 returning href",
      [id],
    )).rows[0]?.href,
  );
  const safe = href && href.startsWith("/") && !href.startsWith("//") ? href : viewer.isStaff ? "/office" : "/jobs";
  // Staff following an operative-style link go to the office equivalent.
  redirect(safe);
}
