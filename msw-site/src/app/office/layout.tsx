import Link from "next/link";
import { requireStaff } from "@/server/auth/viewer";
import { countActiveReports } from "@/server/queries/office";
import { Logo } from "@/components/ui/logo";
import { DemoStrip } from "@/components/layout/demo-strip";
import { UserMenu } from "@/components/layout/user-menu";
import { OfficeNav } from "@/components/layout/office-nav";
import { labels } from "@/lib/format";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireStaff();
  const counts = await countActiveReports(viewer);
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[264px_1fr]">
      <aside aria-label="Office menu" className="sticky top-0 z-30 bg-ink text-white lg:flex lg:h-[100dvh] lg:flex-col lg:border-r lg:border-white/5">
        <div className="hazard h-1" aria-hidden />
        <div className="flex h-16 items-center justify-between px-5 lg:h-20 lg:border-b lg:border-white/5 lg:mb-4">
          <Link href="/office"><Logo sub="Office" /></Link>
          <div className="lg:hidden"><UserMenu viewer={viewer} /></div>
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto"><OfficeNav openReports={counts.n} urgent={counts.urgent} unread={viewer.unreadNotifications} /></div>
        <div className="hidden items-center gap-3 border-t border-white/10 p-4 lg:flex">
          <UserMenu viewer={viewer} align="up" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{viewer.fullName}</p>
            <p className="truncate text-[12px] text-white/70">{labels.role[viewer.role]}</p>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <DemoStrip />
        <main className="mx-auto max-w-[1320px] px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-9">{children}</main>
      </div>
    </div>
  );
}
