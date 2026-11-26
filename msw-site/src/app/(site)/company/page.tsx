import type { Metadata } from "next";
import Link from "next/link";
import { CaretRight, IdentificationCard, UserPlus, Certificate, Warning } from "@phosphor-icons/react/dist/ssr";
import { requireBoss } from "@/server/auth/viewer";
import { getCompanyOverview } from "@/server/queries/company";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState, SectionTitle, Stat } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { expiryState } from "@/lib/cards";
import { londonToday } from "@/lib/week";

export const metadata: Metadata = { title: "My company" };

/** The boss's dashboard: jobs MSW have given the company, their people, and cards that need renewing. */
export default async function CompanyPage() {
  const viewer = await requireBoss();
  const { jobs, people } = await getCompanyOverview(viewer);
  const today = londonToday();
  const lads = people.filter((p) => p.role === "operative");
  const active = lads.filter((p) => p.active);
  const cards = people.flatMap((p) => p.cards.map((c) => ({ ...c, person: p.full_name })));
  const expired = cards.filter((c) => expiryState(c.expires_on, today) === "expired");
  const soon = cards.filter((c) => expiryState(c.expires_on, today) === "soon");
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="My company" title={viewer.companyName}
        description="Your people, their cards, and who can see each job MSW give you." />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Jobs" value={jobs.length} />
        <Stat label="People" value={active.length} />
        <Stat label="Cards due" value={expired.length + soon.length} tone={expired.length ? "danger" : soon.length ? "warn" : undefined} />
      </div>

      {(expired.length > 0 || soon.length > 0) && (
        <Card className="grid gap-2 p-4">
          <p className="flex items-center gap-2 font-semibold"><Warning className="size-5 text-warn" weight="fill" /> Cards to renew</p>
          <ul className="grid gap-1 text-[14px]">
            {[...expired, ...soon].map((c) => (
              <li key={c.id}><Link href={`/company/people/${c.user_id}`} className="underline-offset-2 hover:underline">
                <span className="font-semibold">{c.person}</span> — {c.card_type} {expiryState(c.expires_on, today) === "expired" ? "has expired" : "expires soon"}
              </Link></li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <SectionTitle>Jobs MSW have given you</SectionTitle>
        {jobs.length ? (
          <ul className="grid gap-2">
            {jobs.map((j) => {
              const ticked = active.filter((p) => p.job_ids.includes(j.job_id)).length;
              return (
                <li key={j.job_id}>
                  <Link href={`/company/jobs/${j.job_id}`} className="flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] bg-card px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-line">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-[13px] text-muted">{j.job_number}</span><JobStatusBadge status={j.status} /></span>
                      <span className="block font-semibold leading-snug">{j.name}</span>
                      <span className="block text-[13px] text-muted">{ticked ? `${ticked} of your people can see it` : "Nobody ticked yet — tap to choose"}</span>
                    </span>
                    <CaretRight className="size-5 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title="No jobs yet">When MSW give your company a job it shows here, and you choose who can see it.</EmptyState>}
      </section>

      <section>
        <SectionTitle action={<ButtonLink href="/company/people/new" variant="dark" size="sm"><UserPlus className="size-4" /> Add a person</ButtonLink>}>Your people</SectionTitle>
        <ul className="grid gap-2">
          {people.map((p) => {
            const due = p.cards.filter((c) => ["expired", "soon"].includes(expiryState(c.expires_on, today))).length;
            return (
              <li key={p.id}>
                <Link href={`/company/people/${p.id}`} className="flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] bg-card px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-line">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{p.full_name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{p.full_name}{p.role === "manager" && <span className="ml-2 text-[13px] font-normal text-muted">Boss</span>}{!p.active && <span className="ml-2 text-[13px] font-semibold text-danger">Switched off</span>}</span>
                    <span className="flex items-center gap-1 text-[13px] text-muted">
                      <IdentificationCard className="size-4" /> {p.cards.length} card{p.cards.length === 1 ? "" : "s"}
                      {due > 0 && <span className="font-semibold text-warn"> · {due} to renew</span>}
                      {p.role === "operative" && <> · {p.job_ids.length} job{p.job_ids.length === 1 ? "" : "s"}</>}
                    </span>
                  </span>
                  <CaretRight className="size-5 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Link href="/certificates" className="flex min-h-14 items-center justify-between rounded-[var(--radius-card)] bg-card px-4 font-semibold shadow-[var(--shadow-card)] ring-1 ring-line">
        <span className="flex items-center gap-3"><Certificate className="size-6 text-brand" /><span>Company certificates<span className="block text-[13px] font-normal text-muted">Net certs, insurance, anything for the whole company</span></span></span>
        <CaretRight className="size-5 text-muted" />
      </Link>
    </div>
  );
}
