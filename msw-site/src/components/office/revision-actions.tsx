"use client";

import Link from "next/link";
import { useActionState } from "react";
import { approveRevisionAction, deleteDraftAction, withdrawRevisionAction } from "@/server/actions/documents";
import { idle, type ActionState } from "@/lib/action-state";
import { buttonClass } from "@/components/ui/button";

function ActionButton({ action, revisionId, label, variant, confirmText }: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>; revisionId: string; label: string;
  variant: "success" | "danger" | "secondary"; confirmText?: string;
}) {
  const [state, run, pending] = useActionState(action, idle);
  return (
    <form action={run} onSubmit={(e) => { if (confirmText && !confirm(confirmText)) e.preventDefault(); }} className="contents">
      <input type="hidden" name="revisionId" value={revisionId} />
      <button disabled={pending} className={buttonClass(variant, "sm")}>{pending ? "…" : label}</button>
      {state.error && <span className="basis-full text-[12px] text-danger" role="alert">{state.error}</span>}
    </form>
  );
}

export function RevisionActions({ revisionId, status, hasCurrent }: { revisionId: string; status: string; hasCurrent: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Link href={`/view/${revisionId}`} className={buttonClass("secondary", "sm")}>Open</Link>
      {(status === "draft" || status === "superseded") && (
        <ActionButton action={approveRevisionAction} revisionId={revisionId} variant="success"
          label={status === "draft" ? "Approve for use" : "Reinstate"}
          confirmText={hasCurrent ? "This will supersede the current revision and notify everyone allocated to it. Continue?" : undefined} />
      )}
      {(status === "approved" || status === "draft") && (
        <ActionButton action={withdrawRevisionAction} revisionId={revisionId} variant="danger" label="Withdraw"
          confirmText={status === "approved" ? "Withdraw the current revision? Site users will be told not to use it and no revision will be current." : "Withdraw this draft?"} />
      )}
      {status === "draft" && (
        <ActionButton action={deleteDraftAction} revisionId={revisionId} variant="secondary" label="Delete" confirmText="Delete this draft permanently?" />
      )}
    </div>
  );
}
