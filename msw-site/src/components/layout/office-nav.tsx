"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquaresFour, Buildings, WarningCircle, UsersThree, ClockCounterClockwise, Bell, Signature, ClockClockwise, Timer, Truck, ListChecks } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export function OfficeNav({ openReports, urgent, unread }: { openReports: number; urgent: number; unread: number }) {
  const path = usePathname();
  const groups = [
    { title: "Overview", items: [
      { href: "/office", label: "Dashboard", icon: SquaresFour, exact: true },
      { href: "/office/jobs", label: "Jobs", icon: Buildings },
      { href: "/office/reports", label: "Site reports", icon: WarningCircle, count: openReports, alert: urgent > 0 },
      { href: "/office/notifications", label: "Notifications", icon: Bell, count: unread },
    ] },
    { title: "Sign-offs", items: [
      { href: "/office/handovers", label: "Handovers", icon: Signature },
      { href: "/office/daywork", label: "Daywork sheets", icon: Timer },
      { href: "/office/deliveries", label: "Deliveries", icon: Truck },
    ] },
    { title: "Office", items: [
      { href: "/office/timesheets", label: "Timesheets", icon: ClockClockwise },
      { href: "/office/qs", label: "QS check", icon: ListChecks },
      { href: "/office/people", label: "People & access", icon: UsersThree },
      { href: "/office/activity", label: "Activity", icon: ClockCounterClockwise },
    ] },
  ];
  return (
    <nav aria-label="Office" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:overflow-visible lg:pb-0">
      {groups.map((g) => (
        <div key={g.title} className="contents lg:mb-5 lg:block">
          <p className="hidden px-4 pb-1.5 text-[12px] font-medium uppercase tracking-[0.16em] text-white/70 lg:block">{g.title}</p>
          {g.items.map(({ href, label, icon: Icon, exact, count, alert }) => {
            const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-3 rounded-full px-3.5 py-2.5 text-[15px] font-medium transition-[background-color,color] duration-300 ease-[var(--ease-out-soft)] lg:my-0.5",
                  active ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]" : "text-white/75 hover:bg-white/[0.05] hover:text-white",
                )}>
                <Icon className={cn("size-5", active ? "text-white" : "text-white/60")} weight={active ? "fill" : "light"} />
                <span className="whitespace-nowrap">{label}</span>
                {active && !count && <span className="ml-auto size-1.5 rounded-full bg-brand shadow-[0_0_10px_2px_rgb(211_17_18/0.6)]" aria-hidden />}
                {count ? (
                  <span className={cn("tabular ml-auto rounded-full px-2 text-[12px] font-bold leading-5", alert ? "bg-brand text-white" : "bg-white/12 text-white/90")}>{count}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
