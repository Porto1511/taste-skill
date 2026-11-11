import Link from "next/link";
import { requireStaff } from "@/server/auth/viewer";
import { countActiveReports } from "@/server/queries/office";
import { Logo } from "@/components/ui/logo";
import { DemoStrip } from "@/components/layout/demo-strip";
import { UserMenu } from "@/components/layout/user-menu";
import { OfficeNav } from "@/components/layout/office-nav";
import { OfficeMobileMenu } from "@/components/layout/office-mobile-menu";
import { labels } from "@/lib/format";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireStaff();
  const counts = await countActiveReports(viewer);
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[280px_1fr]">
      <div className="sticky top-0 z-30 p-2 lg:h-[100dvh] lg:p-3">
        <aside aria-label="Office menu" className="glass-dark relative flex flex-col rounded-[1.25rem] text-white lg:h-full lg:rounded-[1.75rem]">
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"><span className="orb -left-16 -top-16 size-48 bg-brand/30" /></span>
          <div className="relative flex h-16 items-center justify-between pl-5 pr-2 lg:h-20 lg:pr-5">
            <Link href="/office"><Logo sub="Office" /></Link>
            <div className="lg:hidden">
              <OfficeMobileMenu name={viewer.fullName} role={viewer.jobTitle ?? labels.role[viewer.role]} company={viewer.companyName}
                counts={{ openReports: counts.n, urgent: counts.urgent, unread: viewer.unreadNotifications }} />
            </div>
          </div>
          <div className="relative hidden lg:block lg:flex-1 lg:overflow-y-auto"><OfficeNav openReports={counts.n} urgent={counts.urgent} unread={viewer.unreadNotifications} /></div>
          <div className="relative m-3 hidden items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/[0.06] lg:flex">
            <UserMenu viewer={viewer} align="up" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{viewer.fullName}</p>
              <p className="truncate text-[12px] text-white/70">{labels.role[viewer.role]}</p>
            </div>
          </div>
        </aside>
      </div>
      <div className="min-w-0">
        <DemoStrip />
        <main className="mx-auto max-w-[1320px] px-4 pb-20 pt-4 sm:px-6 lg:px-10 lg:pt-6">{children}</main>
      </div>
    </div>
  );
}
