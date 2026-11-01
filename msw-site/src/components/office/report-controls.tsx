"use client";

import { useActionState } from "react";
import { setPriorityAction, setSharedAction } from "@/server/actions/reports";
import { idle } from "@/lib/action-state";
import { buttonClass } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-client";

export function ReportControls({ reportId, shared, priority, areaName }: { reportId: string; shared: boolean; priority: string; areaName: string | null }) {
  const [shareState, share] = useActionState(setSharedAction, idle);
  const [prioState, prio] = useActionState(setPriorityAction, idle);
  return (
    <div className="grid gap-4">
      <form action={share} className="grid gap-2">
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="shared" value={shared ? "0" : "1"} />
        <p className="text-sm font-semibold">Visibility</p>
        <p className="text-[13px] text-muted">
          {shared ? `Shared with everyone allocated to ${areaName ?? "this job"}.` : "Only the author, MSW office and explicitly-granted managers of the author's company can see this."}
        </p>
        <button className={buttonClass("secondary", "sm", "justify-self-start")}>{shared ? "Stop sharing" : `Share with ${areaName ?? "job"} team`}</button>
        <FormMessage state={shareState} />
      </form>
      <form action={prio} className="grid gap-2">
        <input type="hidden" name="reportId" value={reportId} />
        <p className="text-sm font-semibold">Priority</p>
        <div className="flex gap-1.5">
          {(["normal", "high", "urgent"] as const).map((p) => (
            <button key={p} name="priority" value={p} aria-pressed={priority === p}
              className={buttonClass(priority === p ? "dark" : "secondary", "sm", "capitalize")}>{p}</button>
          ))}
        </div>
        <FormMessage state={prioState} />
      </form>
    </div>
  );
}
