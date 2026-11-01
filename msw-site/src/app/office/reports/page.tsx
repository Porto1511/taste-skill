import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { listJobOptions, listOfficeReports } from "@/server/queries/office";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ReportTable } from "@/components/office/report-table";
import { Select } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { requestNow } from "@/lib/now";

export const metadata: Metadata = { title: "Site reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string; job?: string; priority?: string }> }) {
  const viewer = await requireStaff();
  const f = await searchParams;
  const status = f.status ?? "active";
  const [reports, jobs] = await Promise.all([
    listOfficeReports(viewer, { status: status === "all" ? undefined : status, kind: f.kind, jobId: f.job, priority: f.priority }),
    listJobOptions(viewer),
  ]);
  return (
    <div>
      <PageHeader title="Site reports" description="Issues, progress updates and photos from every job. Urgent and safety issues are listed first." />
      <form className="mb-4 grid gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <Select name="status" defaultValue={status} aria-label="Status">
          <option value="active">Open &amp; in progress</option><option value="open">Open</option><option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All reports</option>
        </Select>
        <Select name="kind" defaultValue={f.kind ?? ""} aria-label="Type">
          <option value="">All types</option><option value="issue">Issues</option><option value="progress">Progress updates</option><option value="photo">Photos</option>
        </Select>
        <Select name="priority" defaultValue={f.priority ?? ""} aria-label="Priority">
          <option value="">Any priority</option><option value="urgent">Urgent / safety only</option>
        </Select>
        <Select name="job" defaultValue={f.job ?? ""} aria-label="Job">
          <option value="">All jobs</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.job_number} · {j.name}</option>)}
        </Select>
        <button className={buttonClass("dark", "md", "h-auto")}>Filter</button>
      </form>
      <p className="mb-2 text-sm text-muted">{reports.length} report{reports.length === 1 ? "" : "s"}</p>
      <Card className="overflow-hidden"><ReportTable reports={reports} now={requestNow()} /></Card>
    </div>
  );
}
