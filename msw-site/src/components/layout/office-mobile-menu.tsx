"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HardHat, List, SignOut, UserCircle, X } from "@phosphor-icons/react";
import { signOutAction } from "@/app/login/actions";
import { OfficeNav } from "./office-nav";

/** Phone/tablet office menu: one button opens a drop-down with every page, the account and Sign out. */
export function OfficeMobileMenu({ name, role, company, counts }: {
  name: string; role: string; company: string; counts: { openReports: number; urgent: number; unread: number };
}) {
  const path = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path; // navigating anywhere closes it
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");

  return (
    <>
      <button type="button" onClick={() => setOpenOn(open ? null : path)} aria-expanded={open} aria-controls="office-menu"
        className="flex min-h-11 items-center gap-2 rounded-full bg-white/[0.08] py-1.5 pl-1.5 pr-4 text-[15px] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/[0.14]">
        <span className="grid size-8 place-items-center rounded-full bg-white/[0.1] text-[12px] font-semibold">{initials}</span>
        {open ? <X className="size-5" weight="bold" /> : <List className="size-5" weight="bold" />}
        Menu
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpenOn(null)} className="fixed inset-x-0 bottom-0 top-[4.5rem] z-40 cursor-default bg-ink/40 backdrop-blur-[2px]" />
          <div id="office-menu" className="glass-dark fixed inset-x-2 top-[4.75rem] z-50 max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-[1.5rem] py-3 text-white">
            <OfficeNav vertical openReports={counts.openReports} urgent={counts.urgent} unread={counts.unread} />
            <div className="mx-3 mt-3 rounded-2xl bg-white/[0.06] p-2 ring-1 ring-white/[0.08]">
              <div className="flex items-center gap-3 px-2 py-2">
                <span className="grid size-10 place-items-center rounded-full bg-white/[0.1] text-[13px] font-semibold">{initials}</span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-semibold">{name}</span>
                  <span className="block truncate text-[13px] text-white/70">{role} · {company}</span>
                </span>
              </div>
              <Link href="/jobs" className="flex min-h-11 items-center gap-3 rounded-full px-3 text-[15px] text-white/85 hover:bg-white/[0.06]"><HardHat className="size-5" /> Site view</Link>
              <Link href="/account" className="flex min-h-11 items-center gap-3 rounded-full px-3 text-[15px] text-white/85 hover:bg-white/[0.06]"><UserCircle className="size-5" /> Account &amp; password</Link>
              <form action={signOutAction}>
                <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-[15px] font-semibold text-[#ff8a8a] hover:bg-white/[0.06]"><SignOut className="size-5" /> Sign out</button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
