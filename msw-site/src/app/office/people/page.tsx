import type { Metadata } from "next";
import Link from "next/link";
import { Plus, MagnifyingGlass, Buildings } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { listCompanies, listPeople } from "@/server/queries/office";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PeopleTable } from "@/components/office/people-table";
import { requestNow } from "@/lib/now";

export const metadata: Metadata = { title: "People & access" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const viewer = await requireStaff();
  const { q = "" } = await searchParams;
  const [companies, people] = await Promise.all([listCompanies(viewer), listPeople(viewer, { q: q.trim().slice(0, 80) })]);
  return (
    <div>
      <PageHeader title="People & companies" description="MSW employees, subcontracting companies and their operatives. Job access is given per person on each job."
        actions={viewer.isAdmin && <>
          <ButtonLink href="/office/people/companies/new"><Buildings className="size-5" /> Add company</ButtonLink>
          <ButtonLink href="/office/people/new" variant="primary"><Plus className="size-5" weight="bold" /> Add person</ButtonLink>
        </>} />
      <section className="mb-8">
        <SectionTitle>Companies · {companies.length}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((c) => (
            <Link key={c.id} href={`/office/people/companies/${c.id}`} className="rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-ink/30">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{c.name}</p>
                {c.is_msw ? <Badge tone="dark">MSW</Badge> : !c.active ? <Badge tone="danger">Inactive</Badge> : null}
              </div>
              <p className="text-[13px] text-muted">{c.trade ?? "—"}</p>
              <p className="mt-3 text-[13px]"><span className="font-semibold">{c.active_people}</span> active people · <span className="font-semibold">{c.live_jobs}</span> live jobs</p>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <SectionTitle className="mb-0">People · {people.length}</SectionTitle>
          <form className="relative w-full sm:w-72" role="search">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-subtle" />
            <input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search people" className="h-11 w-full rounded-xl border border-line-strong bg-card pl-10 pr-3 focus:border-ink focus:outline-none" />
          </form>
        </div>
        <Card className="overflow-hidden"><PeopleTable people={people} now={requestNow()} /></Card>
      </section>
    </div>
  );
}
