"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireViewer } from "../auth/viewer";
import { deleteCertificate } from "../files/certificates";
import { attempt, str } from "./helpers";
import type { ActionState } from "@/lib/action-state";

export async function deleteCertificateAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const id = z.string().uuid().parse(str(f, "certificateId"));
  return attempt("certificates.delete", async () => {
    await deleteCertificate(viewer, id);
    refresh();
    return { ok: true, message: "Certificate deleted.", nonce: Date.now() };
  });
}
