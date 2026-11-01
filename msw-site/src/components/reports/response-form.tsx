"use client";

import { useActionState, useEffect, useRef } from "react";
import { respondAction } from "@/server/actions/reports";
import { idle } from "@/lib/action-state";
import { Select, Textarea } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";
import { labels } from "@/lib/format";

export function ResponseForm({ reportId, canSetStatus, currentStatus, isIssue }: {
  reportId: string; canSetStatus: boolean; currentStatus: string | null; isIssue: boolean;
}) {
  const [state, action] = useActionState(respondAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <input type="hidden" name="reportId" value={reportId} />
      <label htmlFor={`body-${reportId}`} className="text-sm font-semibold">{canSetStatus ? "Respond to site" : "Add a reply"}</label>
      <Textarea id={`body-${reportId}`} name="body" rows={3} maxLength={4000}
        placeholder={canSetStatus ? "Instruction or update for the person who reported this" : "Add more information for the MSW office"} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {canSetStatus && isIssue && (
          <Select name="status" defaultValue="" className="sm:max-w-64" aria-label="Change status">
            <option value="">Keep status ({labels.reportStatus[currentStatus ?? "open"]})</option>
            {(["open", "in_progress", "resolved", "closed"] as const).filter((s) => s !== currentStatus).map((s) => (
              <option key={s} value={s}>Mark {labels.reportStatus[s].toLowerCase()}</option>
            ))}
          </Select>
        )}
        <SubmitButton size="lg" variant={canSetStatus ? "dark" : "primary"} pendingText="Sending…" className="sm:ml-auto">
          Send
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
