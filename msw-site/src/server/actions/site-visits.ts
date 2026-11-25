"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireViewer } from "../auth/viewer";
import { deleteSiteVisit, setBlockerCleared } from "../files/site-visits";
import { attempt, str } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const id = z.string().uuid();

async function requireSiteVisits() {
  const v = await requireViewer();
  if (!v.canSiteVisit) notFound();
  return v;
}

export async function toggleBlockerAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireSiteVisits();
  const visitId = id.parse(str(f, "visitId"));
  const index = z.coerce.number().int().min(0).max(39).parse(str(f, "index"));
  const cleared = str(f, "cleared") === "1";
  return attempt("site_visits.blocker", async () => {
    await setBlockerCleared(viewer, visitId, index, cleared);
    refresh();
    return { ok: true, nonce: Date.now() };
  });
}

export async function deleteSiteVisitAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireSiteVisits();
  const visitId = id.parse(str(f, "visitId"));
  const res = await attempt("site_visits.delete", async () => { await deleteSiteVisit(viewer, visitId); return { ok: true }; });
  if (res.error) return res;
  redirect(`${viewer.isStaff ? "/office" : ""}/site-visits?deleted=1`);
}
