"use client";

import { useActionState } from "react";
import { reviewTimesheetAction } from "@/server/actions/timesheets";
import { idle } from "@/lib/action-state";
import { Textarea } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/form-client";
import { buttonClass } from "@/components/ui/button";

export function TimesheetReview({ ids, label = "Approve" }: { ids: string[]; label?: string }) {
  const [state, action, pending] = useActionState(reviewTimesheetAction, idle);
  return (
    <form action={action} className="grid gap-2">
      {ids.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
      <Textarea name="note" rows={2} className="min-h-0" placeholder="Note to the operative (required for a query)" maxLength={500} />
      <div className="flex flex-wrap gap-2">
        <button name="status" value="approved" disabled={pending || !ids.length} className={buttonClass("success", "md")}>{label}</button>
        <button name="status" value="query" disabled={pending || !ids.length} className={buttonClass("danger", "md")}>Send a query</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
