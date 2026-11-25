"use client";

import { useActionState } from "react";
import { CheckCircle, Circle } from "@phosphor-icons/react";
import { deleteSiteVisitAction, toggleBlockerAction } from "@/server/actions/site-visits";
import { idle } from "@/lib/action-state";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function BlockerToggle({ visitId, index, cleared, label }: { visitId: string; index: number; cleared: boolean; label: string }) {
  const [state, run, pending] = useActionState(toggleBlockerAction, idle);
  return (
    <form action={run}>
      <input type="hidden" name="visitId" value={visitId} />
      <input type="hidden" name="index" value={index} />
      <input type="hidden" name="cleared" value={cleared ? "0" : "1"} />
      <button disabled={pending} aria-label={cleared ? `Mark "${label}" as not cleared` : `Mark "${label}" as cleared`}
        className={cn("flex min-h-11 items-center gap-2 rounded-full px-3 text-[14px] font-semibold", cleared ? "text-ok hover:bg-ok-soft" : "text-muted hover:bg-paper")}>
        {cleared ? <CheckCircle className="size-5" weight="fill" /> : <Circle className="size-5" />} {cleared ? "Cleared" : "Mark cleared"}
      </button>
      {state.error && <p className="text-[12px] text-danger" role="alert">{state.error}</p>}
    </form>
  );
}

export function DeleteVisitButton({ visitId }: { visitId: string }) {
  const [state, run, pending] = useActionState(deleteSiteVisitAction, idle);
  return (
    <form action={run} onSubmit={(e) => { if (!confirm("Delete this site visit and its photos? This can't be undone.")) e.preventDefault(); }}>
      <input type="hidden" name="visitId" value={visitId} />
      <button disabled={pending} className={buttonClass("danger", "md")}>{pending ? "Deleting…" : "Delete visit"}</button>
      {state.error && <p className="text-[12px] text-danger" role="alert">{state.error}</p>}
    </form>
  );
}
