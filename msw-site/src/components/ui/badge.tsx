import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { labels } from "@/lib/format";

type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "signal" | "dark";
const tones: Record<Tone, string> = {
  neutral: "bg-ink/[0.06] text-ink/75",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  signal: "bg-signal-soft text-signal-ink",
  dark: "bg-ink text-white",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function RevisionStatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "approved" ? "ok" : status === "draft" ? "info" : status === "withdrawn" ? "danger" : "neutral";
  return <Badge tone={tone} dot>{labels.revisionStatus[status] ?? status}</Badge>;
}

export function ReportStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const tone: Tone = status === "open" ? "danger" : status === "in_progress" ? "warn" : status === "resolved" ? "ok" : "neutral";
  return <Badge tone={tone} dot>{labels.reportStatus[status]}</Badge>;
}

export function JobStatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "live" ? "ok" : status === "planned" ? "info" : status === "on_hold" ? "warn" : "neutral";
  return <Badge tone={tone} dot>{labels.jobStatus[status]}</Badge>;
}

export function PriorityBadge({ priority, category }: { priority: string; category?: string | null }) {
  if (priority === "urgent" || category === "safety") return <Badge tone="danger" className="uppercase tracking-wide">{priority === "urgent" ? "Urgent" : "Safety"}</Badge>;
  if (priority === "high") return <Badge tone="warn">High</Badge>;
  return null;
}
