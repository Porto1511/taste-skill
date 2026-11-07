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
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 z-30 bg-ink text-white lg:flex lg:h-[100dvh] lg:flex-col">
        <div className="flex h-16 items-center justify-between px-5 lg:h-20">
          <Link href="/office"><Logo sub="Office" /></Link>
          <div className="lg:hidden"><UserMenu viewer={viewer} /></div>
        </div>
        <OfficeNav openReports={counts.n} urgent={counts.urgent} unread={viewer.unreadNotifications} />
        <div className="mt-auto hidden items-center gap-3 border-t border-white/10 p-4 lg:flex">
          <UserMenu viewer={viewer} align="up" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{viewer.fullName}</p>
            <p className="truncate text-[12px] text-white/50">{labels.role[viewer.role]}</p>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <DemoStrip />
        <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}
