import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/server/auth/viewer";
import { listVariations } from "@/server/queries/variations";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Variations" };

export default async function OfficeVariationsPage() {
  const viewer = await requireStaff();
  const items = await listVariations(viewer);
  return (
    <div>
      <PageHeader title="Variations" description="What clients have asked for on site, signed by the operative and the client. No prices." />
      {items.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {items.map((v) => (
            <Link key={v.id} href={`/office/variations/${v.id}`} className="grid gap-0.5 px-5 py-3 hover:bg-paper sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-4">
              <span className="font-mono text-[13px] text-muted">{v.job_number}{v.area_name ? ` · ${v.area_name}` : ""}</span>
              <span className="min-w-0"><span className="block truncate font-semibold">{v.description}</span>
                <span className="block text-[13px] text-muted">{v.captured_by_name}, {v.captured_by_company} · asked for by {v.requested_by}{v.photo_count ? ` · ${v.photo_count} photo${v.photo_count === 1 ? "" : "s"}` : ""}</span></span>
              <span className="text-[13px] text-muted">{formatDate(v.signed_at)}</span>
            </Link>
          ))}
        </Card>
      ) : <EmptyState title="No variations yet">When a client asks for a change on site, the lads record it here with photos and both signatures.</EmptyState>}
    </div>
  );
}
