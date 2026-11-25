import type { Metadata } from "next";
import Link from "next/link";
import { Binoculars, Plus, Warning } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { listSiteVisits } from "@/server/queries/site-visits";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/form";
import { VISIT_TYPES, labelOf } from "@/lib/site-visit";
import { ReadyBadge } from "@/components/site-visits/ready-badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Site visits" };


export default async function SiteVisitsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const viewer = await requireStaff();
  const { deleted } = await searchParams;
  const visits = await listSiteVisits(viewer);
  return (
    <div>
      <PageHeader title="Site visits" description="What's ready, access & safety, blockers and photos from office site visits. Office only."
        actions={<ButtonLink href="/office/site-visits/new" variant="primary"><Plus className="size-5" weight="bold" /> New site visit</ButtonLink>} />
      {deleted && <Alert tone="ok" className="mb-4">Site visit deleted.</Alert>}
      {visits.length === 0 ? <EmptyState icon={<Binoculars />} title="No site visits yet">Tap New site visit when you&apos;re on site.</EmptyState> : (
        <Card className="divide-y divide-line overflow-hidden">
          {visits.map((v) => (
            <Link key={v.id} href={`/office/site-visits/${v.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-paper">
              <span className="w-24 text-[14px] text-muted">{formatDate(v.visit_date)}</span>
              <span className="font-mono text-[13px]">{v.job_number}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{v.job_name ?? v.site_address}</span>
              <span className="text-[13px] text-muted">{labelOf(VISIT_TYPES, v.visit_type)} · {v.visited_by_name}</span>
              {v.open_blockers > 0 && <span className="flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-[12px] font-bold text-danger"><Warning className="size-3.5" weight="fill" /> {v.open_blockers} blocker{v.open_blockers === 1 ? "" : "s"}</span>}
              <ReadyBadge ready={v.ready} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
