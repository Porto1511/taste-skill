"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export function JobTabs({ jobId, counts }: { jobId: string; counts: { documents: number; people: number; issues: number } }) {
  const path = usePathname();
  const base = `/office/jobs/${jobId}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/documents`, label: "Drawings & RAMS", count: counts.documents },
    { href: `${base}/access`, label: "People & access", count: counts.people },
    { href: `${base}/reports`, label: "Site reports", count: counts.issues, alert: counts.issues > 0 },
    { href: `${base}/handovers`, label: "Sign-offs" },
    { href: `${base}/activity`, label: "Activity" },
  ];
  const current = tabs.find((t) => (t.exact ? path === t.href : path.startsWith(t.href))) ?? tabs[0];
  return (
    <>
      {/* Phones: one drop-down instead of a row that scrolls sideways. */}
      <details key={path} className="group relative mb-5 sm:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-full bg-card px-5 text-[15px] font-semibold shadow-[var(--shadow-card)] ring-1 ring-line [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><span className="text-muted">Section:</span> {current.label}</span>
          <CaretDown className="size-4 text-muted transition-transform group-open:rotate-180" weight="bold" />
        </summary>
        <div className="absolute inset-x-0 top-14 z-20 grid rounded-[1.25rem] bg-card p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-line">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} aria-current={t === current ? "page" : undefined}
              className={cn("flex min-h-11 items-center justify-between rounded-full px-4 text-[15px] font-semibold", t === current ? "bg-ink text-white" : "hover:bg-paper")}>
              {t.label}
              {t.count !== undefined && <span className={cn("tabular rounded-full px-1.5 text-[12px] leading-5", t.alert ? "bg-danger text-white" : t === current ? "bg-white/15" : "bg-ink/[0.07] text-muted")}>{t.count}</span>}
            </Link>
          ))}
        </div>
      </details>
      <nav className="mb-6 hidden gap-1 overflow-x-auto border-b border-line sm:flex" aria-label="Job sections">
        {tabs.map((t) => {
          const active = t === current;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
              className={cn("-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-[15px] font-semibold transition-colors",
                active ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink")}>
              {t.label}
              {t.count !== undefined && (
                <span className={cn("tabular rounded-full px-1.5 text-[12px] leading-5", t.alert ? "bg-danger text-white" : "bg-ink/[0.07] text-muted")}>{t.count}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
