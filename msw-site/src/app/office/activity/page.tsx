import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { listActivity } from "@/server/queries/office";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ActivityFeed } from "@/components/office/activity-feed";
import { ActivityFilters } from "@/components/office/activity-filters";
import { requestNow } from "@/lib/now";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ scope?: string; before?: string }> }) {
  const viewer = await requireStaff();
  const { scope = "", before } = await searchParams;
  const items = await listActivity(viewer, { scope, before: before ? Number(before) : undefined, limit: 100 });
  const last = items.at(-1);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Activity history" description="Every access change, document issue, report and directory change across all jobs." />
      <ActivityFilters base="/office/activity" scope={scope} />
      <Card className="overflow-hidden"><ActivityFeed items={items} now={requestNow()} /></Card>
      {items.length === 100 && last && (
        <a href={`/office/activity?${scope ? `scope=${scope}&` : ""}before=${last.id}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Older entries →</a>
      )}
    </div>
  );
}
