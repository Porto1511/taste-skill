import { READY_OUTCOMES, labelOf } from "@/lib/site-visit";
import { cn } from "@/lib/cn";

export function ReadyBadge({ ready }: { ready: string }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", ready === "yes" ? "bg-ok-soft text-ok" : ready === "conditional" ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger")}>{labelOf(READY_OUTCOMES, ready)}</span>;
}
