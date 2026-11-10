"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FilePdf, CaretRight } from "@phosphor-icons/react";
import type { SiteDocument, SiteArea } from "@/server/queries/site";
import { cn } from "@/lib/cn";
import { LinkPending } from "@/components/ui/link-pending";

const WEEK = 7 * 86400_000;

export function DocumentList({ jobId, documents, areas, kind, now }: {
  jobId: string; documents: SiteDocument[]; areas: SiteArea[]; kind: "drawing" | "rams"; now: number;
}) {
  // Only offer filters for areas that actually have documents, plus "Whole job".
  const filters = useMemo(() => {
    const used = new Map<string, string>();
    let wholeJob = false;
    for (const d of documents) {
      if (d.areas.length === 0) wholeJob = true;
      for (const a of d.areas) used.set(a.id, a.name);
    }
    const ordered = areas.filter((a) => used.has(a.id)).map((a) => ({ id: a.id, name: a.name }));
    return { areas: ordered, wholeJob };
  }, [documents, areas]);
  const [filter, setFilter] = useState<string>("all");

  const shown = documents.filter((d) =>
    filter === "all" ? true : filter === "job" ? d.areas.length === 0 : d.areas.some((a) => a.id === filter),
  );
  const showFilters = filters.areas.length + (filters.wholeJob ? 1 : 0) > 1;

  return (
    <div>
      {showFilters && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label={`Filter ${kind === "drawing" ? "drawings" : "RAMS"} by area`}>
          {[{ id: "all", name: "All" }, ...filters.areas, ...(filters.wholeJob ? [{ id: "job", name: "Whole job" }] : [])].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "h-11 shrink-0 rounded-full border px-4 text-[14px] font-semibold transition-colors",
                filter === f.id ? "border-ink bg-ink text-white" : "border-line-strong bg-card text-ink hover:border-ink/40",
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
        {shown.map((d) => {
          const fresh = now - new Date(d.approved_at).getTime() < WEEK;
          return (
            <li key={d.id}>
              <Link href={`/jobs/${jobId}/documents/${d.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper active:bg-paper">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", kind === "drawing" ? "bg-ink text-signal" : "bg-signal-soft text-signal-ink")}>
                  <FilePdf className="size-6" weight="duotone" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-[13px] font-semibold">{d.doc_number}</span>
                    <span className="rounded-md bg-ok-soft px-1.5 py-px font-mono text-[12px] font-bold text-ok">Rev {d.revision}</span>
                    {fresh && <span className="rounded-md bg-signal px-1.5 py-px text-[12px] font-bold uppercase tracking-wide text-ink">Updated</span>}
                  </span>
                  <span className="mt-0.5 block text-[15px] font-medium leading-snug">{d.title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">
                    {d.areas.length ? d.areas.map((a) => a.name).join(" · ") : "Whole job"}
                  </span>
                </span>
                <LinkPending />
                <CaretRight className="size-5 shrink-0 text-subtle" weight="bold" />
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nothing for this area.</li>}
      </ul>
    </div>
  );
}
