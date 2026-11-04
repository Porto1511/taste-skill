"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function JobTabs({ jobId, counts }: { jobId: string; counts: { documents: number; people: number; issues: number } }) {
  const path = usePathname();
  const base = `/office/jobs/${jobId}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/documents`, label: "Drawings & RAMS", count: counts.documents },
    { href: `${base}/access`, label: "People & access", count: counts.people },
    { href: `${base}/reports`, label: "Site reports", count: counts.issues, alert: counts.issues > 0 },
    { href: `${base}/handovers`, label: "Handovers" },
    { href: `${base}/activity`, label: "Activity" },
  ];
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Job sections">
      {tabs.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-[15px] font-semibold transition-colors",
              active ? "border-signal text-ink" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
            {t.count !== undefined && (
              <span className={cn("tabular rounded-full px-1.5 text-[12px] leading-5", t.alert ? "bg-danger text-white" : "bg-ink/[0.07] text-muted")}>{t.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
