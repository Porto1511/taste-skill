import Link from "next/link";
import { requireViewer } from "@/server/auth/viewer";
import { MswLogo } from "@/components/ui/logo";
import { DemoStrip } from "@/components/layout/demo-strip";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <div className="min-h-[100dvh] overflow-x-clip pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <div className="glass-bar-dark mx-auto flex h-14 max-w-2xl items-center justify-between rounded-full pl-5 pr-1.5 text-white">
          <Link href="/jobs" className="flex min-h-11 items-center gap-2.5" aria-label="Your jobs">
            <MswLogo className="h-6" />
            <span className="h-6 w-px bg-white/15" aria-hidden /><span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/80">Site</span>
          </Link>
          <Link href="/account" className="flex min-h-11 min-w-11 items-center justify-end gap-2 text-[14px] font-medium text-white/85" aria-label="Your account">
            <span className="hidden sm:inline">{viewer.fullName.split(" ")[0]}</span>
            <span className="grid size-10 place-items-center rounded-full bg-white/[0.08] text-[13px] font-semibold text-white/90 ring-1 ring-white/15">{viewer.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
          </Link>
        </div>
      </header>
      <DemoStrip />
      <main className="mx-auto max-w-2xl px-4 pt-5">{children}</main>
      <BottomNav unread={viewer.unreadNotifications} timesheet={viewer.keepsTimesheet} />
    </div>
  );
}
