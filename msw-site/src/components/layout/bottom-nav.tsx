"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, ClockClockwise, Bell, UserCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export function BottomNav({ unread, timesheet }: { unread: number; timesheet: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/jobs", label: "Jobs", icon: HardHat, active: path === "/jobs" || path.startsWith("/jobs/") },
    ...(timesheet ? [{ href: "/timesheet", label: "Timesheet", icon: ClockClockwise, active: path.startsWith("/timesheet") }] : []),
    { href: "/notifications", label: "Alerts", icon: Bell, active: path.startsWith("/notifications"), count: unread },
    { href: "/account", label: "Me", icon: UserCircle, active: path.startsWith("/account") },
  ];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ href, label, icon: Icon, active, count }) => (
          <li key={href} className="flex-1">
            <Link href={href} aria-current={active ? "page" : undefined}
              className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold transition-colors", active ? "text-ink" : "text-muted hover:text-ink")}>
              {active && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-brand" aria-hidden />}
              <span className={cn("relative grid h-8 w-14 place-items-center rounded-full transition-colors", active && "bg-brand-soft")}>
                <Icon className={cn("size-6", active && "text-brand")} weight={active ? "fill" : "regular"} />
                {count ? (
                  <span className="tabular absolute -right-0.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[12px] font-bold leading-[18px] text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
