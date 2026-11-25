import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import Link from "next/link";
import { getOfficeJob } from "@/server/queries/office";
import { listSiteVisits } from "@/server/queries/site-visits";
import { formatDate } from "@/lib/format";
import { Card, SectionTitle, Stat } from "@/components/ui/card";
import { Alert } from "@/components/ui/form";
import { JobForm } from "@/components/office/job-form";
import { AreasManager } from "@/components/office/areas-manager";

export default async function JobOverview({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ created?: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  const { created } = await searchParams;
  const [data, visits] = await Promise.all([getOfficeJob(viewer, jobId), listSiteVisits(viewer, jobId)]);
  if (!data) notFound();
  const s = data.summary;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="order-2 xl:order-1">
        {created && <Alert tone="ok" className="mb-4" title="Job created">Next: add floors or phases on the right, upload drawings, then allocate people.</Alert>}
        {viewer.isAdmin ? <JobForm job={data.job} staff={data.staff} /> : (
          <fieldset disabled className="grid gap-3">
            <p className="text-[14px] text-muted">Only an MSW administrator can change job details.</p>
            <JobForm job={data.job} staff={data.staff} />
          </fieldset>
        )}
      </div>
      <aside className="order-1 grid content-start gap-6 xl:order-2">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="People with access" value={s.people} hint={`${s.companies} companies`} href={`/office/jobs/${jobId}/access`} />
          <Stat label="Open issues" value={s.open_issues} tone={s.urgent_issues ? "danger" : s.open_issues ? "warn" : undefined} href={`/office/jobs/${jobId}/reports`} />
          <Stat label="Current documents" value={s.current_docs} href={`/office/jobs/${jobId}/documents`} />
          <Stat label="Drafts pending" value={s.drafts} hint="Hidden from site" href={`/office/jobs/${jobId}/documents`} />
        </div>
        <section>
          <SectionTitle action={<Link href={`/office/site-visits/new?job=${jobId}`} className="text-sm font-semibold text-brand hover:underline">New visit →</Link>}>Site visits</SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {visits.length === 0 && <p className="px-4 py-3 text-[14px] text-muted">No site visits yet.</p>}
            {visits.slice(0, 5).map((v) => (
              <Link key={v.id} href={`/office/site-visits/${v.id}`} className="flex items-center gap-2 px-4 py-2.5 text-[14px] hover:bg-paper">
                <span className="min-w-0 flex-1 truncate">{formatDate(v.visit_date)} · {v.visited_by_name}</span>
                {v.open_blockers > 0 && <span className="rounded-full bg-danger-soft px-2 text-[12px] font-bold text-danger">{v.open_blockers} blocker{v.open_blockers === 1 ? "" : "s"}</span>}
                <span className={v.ready === "yes" ? "font-semibold text-ok" : v.ready === "conditional" ? "font-semibold text-warn" : "font-semibold text-danger"}>{v.ready === "yes" ? "Ready" : v.ready === "conditional" ? "If…" : "Not yet"}</span>
              </Link>
            ))}
          </Card>
        </section>
        <section>
          <SectionTitle>Floors, phases &amp; areas</SectionTitle>
          <Card className="p-4">{viewer.isAdmin ? <AreasManager jobId={jobId} areas={data.areas} /> : <fieldset disabled><AreasManager jobId={jobId} areas={data.areas} /></fieldset>}</Card>
        </section>
      </aside>
    </div>
  );
}
