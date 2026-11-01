import type { Metadata } from "next";
import { Plus, MagnifyingGlass, Buildings } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { listJobs } from "@/server/queries/office";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { JobsTable } from "@/components/office/jobs-table";
import { cn } from "@/lib/cn";
import { requestNow } from "@/lib/now";

export const metadata: Metadata = { title: "Jobs" };

const tabs = [
  { id: "", label: "All" }, { id: "live", label: "Live" }, { id: "planned", label: "Planned" },
  { id: "on_hold", label: "On hold" }, { id: "complete", label: "Complete" },
];

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const viewer = await requireStaff();
  const { q = "", status = "" } = await searchParams;
  const jobs = await listJobs(viewer, { q: q.trim().slice(0, 80), status });
  return (
    <div>
      <PageHeader title="Jobs" description="Every MSW job, its people, documents and open issues."
        actions={<ButtonLink href="/office/jobs/new" variant="primary"><Plus className="size-5" weight="bold" /> New job</ButtonLink>} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav className="flex gap-1 overflow-x-auto rounded-xl bg-ink/[0.05] p-1" aria-label="Filter by status">
          {tabs.map((t) => (
            <a key={t.id} href={`/office/jobs?status=${t.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold", status === t.id ? "bg-card shadow-[var(--shadow-card)]" : "text-muted hover:text-ink")}>
              {t.label}
            </a>
          ))}
        </nav>
        <form className="relative md:w-80" role="search">
          <input type="hidden" name="status" value={status} />
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-subtle" />
          <input name="q" defaultValue={q} placeholder="Job number, name, postcode, contractor" aria-label="Search jobs"
            className="h-11 w-full rounded-xl border border-line-strong bg-card pl-10 pr-3 text-[15px] focus:border-ink focus:outline-none" />
        </form>
      </div>
      {jobs.length ? (
        <Card className="overflow-hidden"><JobsTable jobs={jobs} now={requestNow()} /></Card>
      ) : (
        <EmptyState icon={<Buildings />} title={q || status ? "No jobs match" : "No jobs yet"} action={!q && <ButtonLink href="/office/jobs/new" variant="primary">Create the first job</ButtonLink>}>
          {q || status ? "Try a different search or filter." : "Create a job, add its floors or phases, then allocate people."}
        </EmptyState>
      )}
    </div>
  );
}
