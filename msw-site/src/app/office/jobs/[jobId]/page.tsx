import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getOfficeJob } from "@/server/queries/office";
import { Card, SectionTitle, Stat } from "@/components/ui/card";
import { Alert } from "@/components/ui/form";
import { JobForm } from "@/components/office/job-form";
import { AreasManager } from "@/components/office/areas-manager";

export default async function JobOverview({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ created?: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  const { created } = await searchParams;
  const data = await getOfficeJob(viewer, jobId);
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
          <SectionTitle>Floors, phases &amp; areas</SectionTitle>
          <Card className="p-4">{viewer.isAdmin ? <AreasManager jobId={jobId} areas={data.areas} /> : <fieldset disabled><AreasManager jobId={jobId} areas={data.areas} /></fieldset>}</Card>
        </section>
      </aside>
    </div>
  );
}
