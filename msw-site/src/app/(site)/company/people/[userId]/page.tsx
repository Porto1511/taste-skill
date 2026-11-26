import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBoss } from "@/server/auth/viewer";
import { getCompanyOverview } from "@/server/queries/company";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/form";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { AddCard, CardList } from "@/components/company/cards";
import { ActiveToggle, EditOperativeForm, JobTick } from "@/components/company/people-forms";
import { londonToday } from "@/lib/week";

export const metadata: Metadata = { title: "Person" };

export default async function CompanyPersonPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ added?: string }> }) {
  const viewer = await requireBoss();
  const { userId } = await params;
  const { added } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  const { jobs, people } = await getCompanyOverview(viewer);
  const p = people.find((x) => x.id === userId);
  if (!p) notFound();
  const isLad = p.role === "operative";
  return (
    <div className="grid gap-6">
      <PageHeader back={{ href: "/company", label: viewer.companyName }} eyebrow={p.job_title ?? (isLad ? "Operative" : "Manager")} title={p.full_name}
        description={<>{p.email}{p.phone ? ` · ${p.phone}` : ""}</>} />
      {added && <Alert tone="ok" title={`${p.full_name} has been added`}>Give them the email and password you set. Now add their cards and tick their jobs below.</Alert>}
      {!p.active && <Alert tone="warn" title="Switched off">They can&apos;t sign in or see any job.</Alert>}

      <section>
        <SectionTitle>Cards and tickets</SectionTitle>
        <div className="grid gap-3">
          <CardList cards={p.cards} today={londonToday()} canEdit owner={p.full_name} />
          <AddCard userId={p.id} />
        </div>
      </section>

      {isLad && (
        <section>
          <SectionTitle>Jobs they can see</SectionTitle>
          {jobs.length ? (
            <div className="grid gap-2">
              {jobs.map((j) => (
                <JobTick key={j.job_id} jobId={j.job_id} userId={p.id} on={p.job_ids.includes(j.job_id)} label={`${j.job_number} — ${j.name}`} sub={j.site_address} disabled={!p.active} />
              ))}
              <p className="px-1 text-[13px] text-muted">They see all the drawings, RAMS and info for a ticked job.</p>
            </div>
          ) : <EmptyState title="No jobs yet">MSW haven&apos;t given your company a job yet.</EmptyState>}
        </section>
      )}

      {isLad && (
        <section>
          <SectionTitle>Details</SectionTitle>
          <Card className="p-5"><EditOperativeForm person={p} /></Card>
        </section>
      )}
      {isLad && <ActiveToggle userId={p.id} active={p.active} name={p.full_name} />}
    </div>
  );
}
