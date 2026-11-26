import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBoss } from "@/server/auth/viewer";
import { getCompanyJobActivity, getCompanyOverview } from "@/server/queries/company";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { JobTick } from "@/components/company/people-forms";
import { formatDateTime, labels } from "@/lib/format";

export const metadata: Metadata = { title: "Job" };

/** One job given to the company: tick who can see it, and everything the company has done on it. */
export default async function CompanyJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireBoss();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const { jobs, people } = await getCompanyOverview(viewer);
  const job = jobs.find((j) => j.job_id === jobId);
  if (!job) notFound();
  const lads = people.filter((p) => p.role === "operative" && p.active);
  const a = await getCompanyJobActivity(viewer, jobId);
  const items = [
    ...a.reports.map((r) => ({ id: r.id, when: r.created_at, kind: r.kind === "issue" ? "Issue" : r.kind === "progress" ? "Progress" : "Photos", text: r.title, who: r.author_name, href: `/jobs/${jobId}/reports/${r.id}` })),
    ...a.dayworks.map((d) => ({ id: d.id, when: d.signed_at, kind: "Daywork", text: d.description, who: d.captured_by_name, href: `/jobs/${jobId}/daywork/${d.id}` })),
    ...a.variations.map((v) => ({ id: v.id, when: v.signed_at, kind: "Variation", text: v.description, who: v.captured_by_name, href: `/jobs/${jobId}/variation/${v.id}` })),
    ...a.handovers.map((h) => ({ id: h.id, when: h.signed_at, kind: "Sign-off", text: h.title, who: h.captured_by_name, href: `/jobs/${jobId}/handovers/${h.id}` })),
  ].sort((x, y) => y.when.localeCompare(x.when));
  return (
    <div className="grid gap-6">
      <PageHeader back={{ href: "/company", label: viewer.companyName }}
        eyebrow={<span className="flex items-center gap-2"><span className="font-mono">{job.job_number}</span><JobStatusBadge status={job.status} /></span>}
        title={job.name} description={job.site_address}
        actions={job.status === "live" ? <ButtonLink href={`/jobs/${jobId}`} variant="dark" size="md">Open the job</ButtonLink> : undefined} />
      {job.status !== "live" && <p className="-mt-3 text-[14px] text-muted">{job.status === "planned" ? "Not started yet. You can tick people now; they'll see it when MSW make it live." : `This job is ${(labels.jobStatus[job.status] ?? job.status).toLowerCase()}.`}</p>}

      <section>
        <SectionTitle>Who can see this job</SectionTitle>
        {lads.length ? (
          <div className="grid gap-2">
            {lads.map((p) => <JobTick key={p.id} jobId={jobId} userId={p.id} on={p.job_ids.includes(jobId)} label={p.full_name} sub={p.job_title ?? undefined} />)}
          </div>
        ) : <EmptyState title="No people yet" action={<ButtonLink href="/company/people/new" variant="dark" size="sm">Add a person</ButtonLink>}>Add your lads first, then tick them here.</EmptyState>}
      </section>

      <section>
        <SectionTitle>What your people have done here</SectionTitle>
        {items.length ? (
          <Card className="divide-y divide-line overflow-hidden">
            {items.map((i) => (
              <Link key={i.kind + i.id} href={i.href} className="block px-4 py-3 hover:bg-paper">
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{i.kind} · {formatDateTime(i.when)}</p>
                <p className="font-semibold leading-snug">{i.text}</p>
                <p className="text-[13px] text-muted">{i.who}</p>
              </Link>
            ))}
          </Card>
        ) : <EmptyState title="Nothing yet">Issues, daywork, variations and sign-offs from your people will show here.</EmptyState>}
      </section>
    </div>
  );
}
