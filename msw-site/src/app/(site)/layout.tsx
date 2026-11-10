import Link from "next/link";
import { requireViewer } from "@/server/auth/viewer";
import { MswLogo } from "@/components/ui/logo";
import { DemoStrip } from "@/components/layout/demo-strip";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <div className="min-h-[100dvh] overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-ink pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/jobs" className="flex min-h-11 items-center gap-2" aria-label="Your jobs">
            <span className="rounded-md bg-white px-2 py-1.5"><MswLogo className="h-5" /></span>
            <span className="text-[16px] font-semibold tracking-tight text-white/85">Site</span>
          </Link>
        </div>
      </header>
      <DemoStrip />
      <main className="mx-auto max-w-2xl px-4 pt-4">{children}</main>
      <BottomNav unread={viewer.unreadNotifications} timesheet={viewer.keepsTimesheet} />
    </div>
  );
}
