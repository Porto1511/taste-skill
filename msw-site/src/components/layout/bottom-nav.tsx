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
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
      <ul className="glass-bar mx-auto flex max-w-md rounded-full p-1.5">
        {items.map(({ href, label, icon: Icon, active, count }) => (
          <li key={href} className="flex-1">
            <Link href={href} aria-current={active ? "page" : undefined}
              className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] font-semibold transition-[background-color,color] duration-300 ease-[var(--ease-out-soft)]", active ? "bg-ink text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]" : "text-muted hover:text-ink")}>
              <span className="relative grid place-items-center">
                <Icon className="size-[22px]" weight={active ? "fill" : "regular"} />
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
