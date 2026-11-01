import { requireStaff } from "@/server/auth/viewer";
import { listActivity } from "@/server/queries/office";
import { Card } from "@/components/ui/card";
import { ActivityFeed } from "@/components/office/activity-feed";
import { ActivityFilters } from "@/components/office/activity-filters";
import { requestNow } from "@/lib/now";

export default async function JobActivityPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ scope?: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  const { scope = "" } = await searchParams;
  const items = await listActivity(viewer, { jobId, scope, limit: 200 });
  return (
    <div>
      <ActivityFilters base={`/office/jobs/${jobId}/activity`} scope={scope} />
      <Card className="overflow-hidden"><ActivityFeed items={items} now={requestNow()} showJob={false} /></Card>
      <p className="mt-2 text-[12px] text-muted">The activity history is append-only and written by the database itself; it cannot be edited from the app.</p>
    </div>
  );
}
