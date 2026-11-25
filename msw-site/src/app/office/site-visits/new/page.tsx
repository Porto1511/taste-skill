import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { withUser } from "@/server/db";
import { PageHeader } from "@/components/layout/page-header";
import { SiteVisitForm, type KnownJob } from "@/components/site-visits/site-visit-form";
import { londonToday } from "@/server/queries/timesheets";

export const metadata: Metadata = { title: "New site visit" };

export default async function NewSiteVisitPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const viewer = await requireStaff();
  const { job } = await searchParams;
  const knownJobs = await withUser(viewer.id, async (tx) => (await tx.query<KnownJob>(
    `select j.id, j.job_number, j.name, j.site_address || coalesce(', ' || j.postcode, '') as address,
            coalesce((select array_agg(a.name order by a.sort_order, a.name) from job_areas a where a.job_id = j.id), '{}') as areas
       from jobs j where j.status in ('planned', 'live', 'on_hold') order by j.job_number desc`)).rows);
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/office/site-visits", label: "Site visits" }} title="New site visit" description="Work down the page on site. Only the job number, address, type and outcome are needed — fill in what applies." />
      <SiteVisitForm knownJobs={knownJobs} today={londonToday()} defaultJobId={job} />
    </div>
  );
}
