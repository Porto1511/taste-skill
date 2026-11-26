"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff } from "../auth/viewer";
import { withUser } from "../db";
import { attempt, str } from "./helpers";
import type { ActionState } from "@/lib/action-state";

/** The office marks an invoice checked, or raises a query (the manager is told). */
export async function checkInvoiceAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const id = z.string().uuid().parse(str(f, "invoiceId"));
  const status = z.enum(["submitted", "checked", "query"]).parse(str(f, "status"));
  const note = (str(f, "note") ?? "").trim().slice(0, 2000) || null;
  if (status === "query" && !note) return { error: "Say what the query is.", nonce: Date.now() };
  return attempt("invoices.check", async () => {
    await withUser(viewer.id, (tx) => tx.query("update subcontractor_invoices set status = $1, office_note = $2 where id = $3", [status, note, id]));
    refresh();
    return { ok: true, message: status === "checked" ? "Marked as checked." : status === "query" ? "Query sent to their manager." : "Saved.", nonce: Date.now() };
  });
}
