import Link from "next/link";
import { Bell } from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { Logo } from "@/components/ui/logo";
import { DemoStrip } from "@/components/layout/demo-strip";
import { UserMenu } from "@/components/layout/user-menu";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 bg-ink pt-[env(safe-area-inset-top)] text-white shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/jobs" aria-label="My jobs"><Logo /></Link>
          <div className="flex items-center gap-1">
            {viewer.isStaff && (
              <Link href="/office" className="mr-1 hidden rounded-full border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-white/85 hover:bg-white/10 sm:inline-block">Office</Link>
            )}
            <Link href="/notifications" className="relative grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label={`Notifications${viewer.unreadNotifications ? `, ${viewer.unreadNotifications} unread` : ""}`}>
              <Bell className="size-6" weight={viewer.unreadNotifications ? "fill" : "regular"} />
              {viewer.unreadNotifications > 0 && (
                <span className="tabular absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-signal px-1 text-[11px] font-bold leading-5 text-ink">
                  {viewer.unreadNotifications > 99 ? "99+" : viewer.unreadNotifications}
                </span>
              )}
            </Link>
            <UserMenu viewer={viewer} />
          </div>
        </div>
      </header>
      <DemoStrip />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">{children}</main>
    </div>
  );
}
