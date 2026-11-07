import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getSiteJob } from "@/server/queries/site";
import { listDayworks, listHandovers } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { DayworkForm } from "@/components/handover/daywork-form";
import { londonToday, mondayOf } from "@/lib/week";

export const metadata: Metadata = { title: "Daywork sheet" };

export default async function DayworkPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireViewer();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const data = await getSiteJob(viewer, jobId);
  if (!data) notFound();
  const [lastDw] = await listDayworks(viewer, jobId);
  const [lastHo] = await listHandovers(viewer, jobId);
  const contractor = (data.job.main_contractor ?? "").replace(/ \(fictional\)$/, "");
  return (
    <div>
      <PageHeader back={{ href: `/jobs/${jobId}#reports`, label: data.job.name }} title="Daywork sheet"
        description="For standing time or extra work that needs signing up. Hours and materials only." />
      <DayworkForm jobId={jobId} week={mondayOf(londonToday())} myHours={{}}
        me={{ name: viewer.fullName, trade: viewer.jobTitle ?? "" }}
        defaultClient={{
          name: lastDw?.client_name ?? lastHo?.signer_name ?? data.job.site_contact_name ?? "",
          position: lastHo?.signer_position ?? data.job.site_contact_role?.split(",")[0] ?? "",
          company: lastDw?.client_company ?? lastHo?.signer_company ?? contractor,
          email: lastHo?.signer_email ?? "",
        }} />
    </div>
  );
}
