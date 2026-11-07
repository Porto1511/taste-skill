"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquaresFour, Buildings, WarningCircle, UsersThree, ClockCounterClockwise, Bell, HardHat, Signature, ClockClockwise, Timer, Truck } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export function OfficeNav({ openReports, urgent, unread }: { openReports: number; urgent: number; unread: number }) {
  const path = usePathname();
  const items = [
    { href: "/office", label: "Dashboard", icon: SquaresFour, exact: true },
    { href: "/office/jobs", label: "Jobs", icon: Buildings },
    { href: "/office/reports", label: "Site reports", icon: WarningCircle, count: openReports, alert: urgent > 0 },
    { href: "/office/handovers", label: "Handovers", icon: Signature },
    { href: "/office/daywork", label: "Daywork sheets", icon: Timer },
    { href: "/office/deliveries", label: "Deliveries", icon: Truck },
    { href: "/office/timesheets", label: "Timesheets", icon: ClockClockwise },
    { href: "/office/people", label: "People & access", icon: UsersThree },
    { href: "/office/activity", label: "Activity", icon: ClockCounterClockwise },
    { href: "/office/notifications", label: "Notifications", icon: Bell, count: unread },
  ];
  return (
    <nav aria-label="Office" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
      {items.map(({ href, label, icon: Icon, exact, count, alert }) => {
        const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
              active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("size-5", active && "text-signal")} weight={active ? "fill" : "regular"} />
            <span className="whitespace-nowrap">{label}</span>
            {count ? (
              <span className={cn("tabular ml-auto rounded-full px-2 text-[12px] font-bold leading-5", alert ? "bg-danger text-white" : "bg-white/12 text-white/85")}>
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
      <Link href="/jobs" className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-white/65 hover:bg-white/5 hover:text-white lg:mt-4 lg:border-t lg:border-white/10 lg:pt-4">
        <HardHat className="size-5" />
        <span className="whitespace-nowrap">Site view</span>
      </Link>
    </nav>
  );
}
