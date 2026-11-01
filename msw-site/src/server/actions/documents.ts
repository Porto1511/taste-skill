"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "../auth/viewer";
import { withUser } from "../db";
import { attempt, str, strs } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const id = z.string().uuid();

export async function approveRevisionAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const revisionId = id.parse(str(f, "revisionId"));
  return attempt("revisions.approve", async () => {
    await withUser(viewer.id, (tx) => tx.query("select public.approve_revision($1)", [revisionId]));
    refresh();
    return { ok: true, message: "Approved for use. Everyone allocated to this drawing's areas has been notified.", nonce: Date.now() };
  });
}

export async function withdrawRevisionAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const revisionId = id.parse(str(f, "revisionId"));
  return attempt("revisions.withdraw", async () => {
    await withUser(viewer.id, (tx) => tx.query("select public.withdraw_revision($1)", [revisionId]));
    refresh();
    return { ok: true, message: "Revision withdrawn. Site users who had it were told not to use it.", nonce: Date.now() };
  });
}

export async function deleteDraftAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const revisionId = id.parse(str(f, "revisionId"));
  return attempt("revisions.delete", async () => {
    const path = await withUser(viewer.id, async (tx) =>
      (await tx.query<{ storage_path: string }>(
        "delete from document_revisions where id = $1 and status = 'draft' returning storage_path",
        [revisionId],
      )).rows[0]?.storage_path,
    );
    if (!path) return { error: "Only draft revisions can be deleted." };
    const { getFileStore } = await import("../storage");
    await getFileStore().remove([path]).catch(() => {});
    refresh();
    return { ok: true, message: "Draft deleted.", nonce: Date.now() };
  });
}

const docSchema = z.object({
  documentId: id,
  docNumber: z.string().trim().min(1, "Enter the document number").max(60),
  title: z.string().trim().min(2, "Enter a title").max(200),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
  areaIds: z.array(id),
});

export async function updateDocumentAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const parsed = docSchema.safeParse({
    documentId: str(f, "documentId"), docNumber: str(f, "docNumber"), title: str(f, "title"),
    description: str(f, "description"), areaIds: strs(f, "areaIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  return attempt("documents.update", async () => {
    await withUser(viewer.id, async (tx) => {
      await tx.query("update documents set doc_number = $1, title = $2, description = $3 where id = $4", [d.docNumber, d.title, d.description, d.documentId]);
      await tx.query("select public.set_document_areas($1, $2::uuid[])", [d.documentId, d.areaIds]);
    });
    refresh();
    return { ok: true, message: "Document details saved.", nonce: Date.now() };
  });
}

export async function openRevisionAction(f: FormData) {
  await requireStaff();
  redirect(`/view/${id.parse(str(f, "revisionId"))}`);
}
