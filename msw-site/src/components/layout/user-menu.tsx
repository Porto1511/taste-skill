import Link from "next/link";
import { SignOut, UserCircle, HardHat } from "@phosphor-icons/react/dist/ssr";
import { signOutAction } from "@/app/login/actions";
import type { Viewer } from "@/server/auth/viewer";
import { initials, labels } from "@/lib/format";
import { cn } from "@/lib/cn";

export function UserMenu({ viewer, tone = "dark", align = "right", showSwitch = true }: { viewer: Viewer; tone?: "dark" | "light"; align?: "right" | "up"; showSwitch?: boolean }) {
  return (
    <details className="group relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-full p-1 pr-1.5 [&::-webkit-details-marker]:hidden",
          tone === "dark" ? "hover:bg-white/10" : "hover:bg-ink/5",
        )}
        aria-label="Account menu"
      >
        <span className="grid size-9 place-items-center rounded-full bg-brand text-[13px] font-bold text-white">{initials(viewer.fullName)}</span>
      </summary>
      <div
        className={cn(
          "absolute z-40 w-64 rounded-2xl border border-line bg-card p-2 text-ink shadow-[var(--shadow-lift)]",
          align === "right" ? "right-0 top-12" : "bottom-14 -left-1",
        )}
      >
        <div className="px-3 py-2">
          <p className="font-semibold">{viewer.fullName}</p>
          <p className="text-[13px] text-muted">{viewer.jobTitle ?? labels.role[viewer.role]}</p>
          <p className="text-[13px] text-muted">{viewer.companyName}</p>
        </div>
        <div className="my-1 h-px bg-line" />
        {showSwitch && viewer.isStaff && (
          // Office staff only: open the phone screens, e.g. to get a handover signed on site.
          <Link href="/jobs" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] hover:bg-paper"><HardHat className="size-5" /> Site view</Link>
        )}
        <Link href="/account" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] hover:bg-paper"><UserCircle className="size-5" /> Account &amp; password</Link>
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] hover:bg-paper"><SignOut className="size-5" /> Sign out</button>
        </form>
      </div>
    </details>
  );
}
