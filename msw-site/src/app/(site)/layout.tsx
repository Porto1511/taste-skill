import Link from "next/link";
import { requireViewer } from "@/server/auth/viewer";
import { MswLogo } from "@/components/ui/logo";
import { DemoStrip } from "@/components/layout/demo-strip";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <div className="min-h-[100dvh] overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-ink pt-[env(safe-area-inset-top)] text-white shadow-[0_6px_20px_-12px_rgba(0,0,0,0.6)]">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/jobs" className="flex min-h-11 items-center gap-2.5" aria-label="Your jobs">
            <span className="rounded-md bg-white px-2 py-1.5"><MswLogo className="h-5" /></span>
            <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/80">Site</span>
          </Link>
          <Link href="/account" className="flex min-h-11 min-w-11 items-center justify-end gap-2 text-[14px] font-medium text-white/85" aria-label="Your account">
            <span className="hidden sm:inline">{viewer.fullName.split(" ")[0]}</span>
            <span className="grid size-9 place-items-center rounded-full bg-brand text-[13px] font-bold text-white">{viewer.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
          </Link>
        </div>
        <div className="hazard h-1" aria-hidden />
      </header>
      <DemoStrip />
      <main className="mx-auto max-w-2xl px-4 pt-5">{children}</main>
      <BottomNav unread={viewer.unreadNotifications} timesheet={viewer.keepsTimesheet} />
    </div>
  );
}
