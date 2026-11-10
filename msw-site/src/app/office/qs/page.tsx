import type { Metadata } from "next";
import Link from "next/link";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { groupDaywork, jobCards, qsFilterOptions, qsSummary } from "@/server/queries/qs";
import { londonToday } from "@/server/queries/timesheets";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { DAYS, tradeLabel } from "@/lib/handover";
import { formatDate, formatShortDate, labels } from "@/lib/format";
import { hrs, parseQsParams, qsPresets } from "@/lib/qs";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "QS check" };

type Params = { from?: string; to?: string; job?: string; company?: string };

export default async function QsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await requireStaff();
  const raw = await searchParams;
  const today = londonToday();
  const f = parseQsParams(raw, today);
  const [data, opts] = await Promise.all([qsSummary(viewer, f), qsFilterOptions(viewer)]);
  const companies = groupDaywork(data.daywork);
  const job = f.jobId ? opts.jobs.find((j) => j.id === f.jobId) : undefined;
  const cards = job ? [] : jobCards(opts.jobs, data);
  const standing = companies.reduce((s, c) => s + c.standing, 0);
  const extra = companies.reduce((s, c) => s + c.extra, 0);
  const sheets = companies.reduce((s, c) => s + c.sheets.length, 0);
  const openIssues = data.issues.filter((i) => i.status === "open" || i.status === "in_progress").length;
  const qs = (o: Partial<Params>) => {
    const q = new URLSearchParams({ from: f.from, to: f.to, ...(f.jobId ? { job: f.jobId } : {}), ...(f.companyId ? { company: f.companyId } : {}), ...o });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return q.toString();
  };

  return (
    <div className="grid gap-6">
      <PageHeader title="QS check"
        description="What was signed off on site for the dates below — handovers, daywork (standing time and extra work) and site issues — to check against subcontractor invoices. Hours and counts only."
        actions={<ButtonLink href={`/api/qs/export?${qs({})}`} external><DownloadSimple className="size-5" /> Export CSV</ButtonLink>} />

      <Card className="grid gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          {qsPresets(today).map((p) => (
            <Link key={p.label} href={`/office/qs?${qs({ from: p.from, to: p.to })}`}
              className={cn("rounded-full border px-3 py-1.5 text-[13px] font-semibold", p.from === f.from && p.to === f.to ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:bg-paper")}>
              {p.label}
            </Link>
          ))}
        </div>
        <form method="get" className="grid gap-2 sm:grid-cols-[9.5rem_9.5rem_1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-[12px] font-semibold text-muted">From<Input type="date" name="from" defaultValue={f.from} /></label>
          <label className="grid gap-1 text-[12px] font-semibold text-muted">To<Input type="date" name="to" defaultValue={f.to} /></label>
          <label className="grid gap-1 text-[12px] font-semibold text-muted">Job
            <Select name="job" defaultValue={f.jobId ?? ""}><option value="">All jobs</option>{opts.jobs.map((j) => <option key={j.id} value={j.id}>{j.job_number} — {j.name}</option>)}</Select>
          </label>
          <label className="grid gap-1 text-[12px] font-semibold text-muted">Company
            <Select name="company" defaultValue={f.companyId ?? ""}><option value="">All companies</option>{opts.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </label>
          <button type="submit" className={buttonClass("dark", "md")}>Show</button>
        </form>
        <p className="text-[13px] text-muted">Showing {formatDate(f.from)} to {formatDate(f.to)}. Daywork hours are counted on the day they were worked.</p>
      </Card>

      {job && (
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/office/qs?${qs({ job: "" })}`} className="text-[14px] font-semibold underline">← All jobs</Link>
          <h2 className="text-[20px] font-semibold"><span className="font-mono text-[16px] text-muted">{job.job_number}</span> {job.name}</h2>
        </div>
      )}
      {job ? (
        <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Handovers signed" value={String(data.handovers.length)} />
        <Stat label="Daywork sheets" value={String(sheets)} />
        <Stat label="Standing time" value={hrs(standing)} tone="warn" />
        <Stat label="Extra work" value={hrs(extra)} tone="info" />
        <Stat label="Site issues" value={String(data.issues.length)} />
        <Stat label="Issues still open" value={String(openIssues)} tone={openIssues ? "warn" : undefined} />
      </div>

      <section>
        <SectionTitle>Sign-offs (handovers) · {data.handovers.length}</SectionTitle>
        {data.handovers.length ? (
          <Card className="divide-y divide-line">
            {data.handovers.map((h) => (
              <Link key={h.id} href={`/office/handovers/${h.id}`} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5 text-[14px] hover:bg-paper">
                <span className="w-28 text-muted">{formatShortDate(h.signed_at.slice(0, 10))}</span>
                <span className="font-mono text-[13px]">{h.job_number}</span>
                <span className="font-medium">{h.title}</span>
                <span className="text-muted">{h.scopes.map(tradeLabel).join(", ")} · {h.company} · signed by {h.signer_name}</span>
              </Link>
            ))}
          </Card>
        ) : <Empty>No handovers in these dates.</Empty>}
      </section>

      <section>
        <SectionTitle>Daywork by gang</SectionTitle>
        {companies.length ? (
          <div className="grid gap-4">
            {companies.map((c) => (
              <Card key={c.id} className="overflow-hidden">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-4 py-3">
                  <h3 className="text-[16px] font-semibold">{c.company}</h3>
                  <p className="text-[14px]"><span className="font-semibold text-warn">Standing {hrs(c.standing)}</span> · <span className="font-semibold text-info">Extra {hrs(c.extra)}</span> · Total <span className="tabular font-bold">{hrs(c.standing + c.extra)}</span></p>
                </div>
                <ul className="divide-y divide-line">
                  {c.sheets.map(({ line: s, hours, people }) => {
                    const rows = data.daywork.filter((l) => l.daywork_id === s.daywork_id);
                    const persons = [...new Set(rows.map((r) => r.person))];
                    return (
                      <li key={s.daywork_id}>
                        <details className="group">
                          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-paper">
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", s.kind === "standing" ? "bg-warn-soft text-warn" : "bg-info-soft text-info")}>{s.kind === "standing" ? "Standing time" : "Extra work"}</span>
                            <span className="font-mono text-[13px]">{s.job_number}</span>
                            <span className="text-[14px]">W/C {formatShortDate(s.week_commencing)}</span>
                            <span className="text-[13px] text-muted">{people.size} {people.size === 1 ? "person" : "people"} · signed by {s.client_name}</span>
                            <span className="tabular ml-auto font-bold">{hrs(hours)}</span>
                          </summary>
                          <div className="overflow-x-auto px-4 pb-3">
                            <table className="w-full min-w-[560px] text-[13px]">
                              <thead><tr className="text-left text-muted"><th className="py-1 font-semibold">Name</th><th className="font-semibold">Trade</th>{DAYS.map((d) => <th key={d.id} className="text-center font-semibold">{d.short}</th>)}<th className="text-right font-semibold">Total</th></tr></thead>
                              <tbody>
                                {persons.map((p) => {
                                  const mine = rows.filter((r) => r.person === p);
                                  return (
                                    <tr key={p} className="border-t border-line">
                                      <td className="py-1.5 font-medium">{p}</td><td>{mine[0].trade}</td>
                                      {DAYS.map((d, i) => { const h = mine.find((r) => r.day === addDays(s.week_commencing, i))?.hours; return <td key={d.id} className="tabular text-center">{h ?? ""}</td>; })}
                                      <td className="tabular text-right font-semibold">{hrs(mine.reduce((a, r) => a + r.hours, 0))}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <Link href={`/office/daywork/${s.daywork_id}`} className="mt-2 inline-block text-[13px] font-semibold underline">Open the signed sheet</Link>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        ) : <Empty>No daywork on this job in these dates.</Empty>}
      </section>


      <section>
        <SectionTitle>Site issues · {data.issues.length}</SectionTitle>
        {data.issues.length ? (
          <Card className="divide-y divide-line">
            {data.issues.map((i) => (
              <Link key={i.id} href={`/office/reports/${i.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[14px] hover:bg-paper">
                <span className="w-28 text-muted">{formatShortDate(i.created_at.slice(0, 10))}</span>
                <span className="font-mono text-[13px]">{i.job_number}</span>
                <span className="font-medium">{i.title}</span>
                <span className="text-muted">{labels.category[i.category] ?? i.category} · {i.author_name} ({i.company})</span>
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold", i.status === "open" || i.status === "in_progress" ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")}>{labels.reportStatus[i.status] ?? i.status}</span>
              </Link>
            ))}
          </Card>
        ) : <Empty>No site issues in these dates.</Empty>}
      </section>
        </>
      ) : (
      <section>
        <SectionTitle>Jobs · click one to see its sign-offs, daywork and issues</SectionTitle>
        {cards.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <Link key={c.id} href={`/office/qs?${qs({ job: c.id })}`}
                className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-card)] transition hover:border-ink/40 hover:shadow-md">
                <div>
                  <p className="font-mono text-[13px] text-muted">{c.job_number}</p>
                  <p className="text-[16px] font-semibold leading-snug">{c.name}</p>
                  {c.gangs.length > 0 && <p className="mt-0.5 truncate text-[12.5px] text-muted">{c.gangs.join(" · ")}</p>}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Mini label="Sign-offs" value={String(c.handovers)} />
                  <Mini label="Standing" value={hrs(c.standing)} tone={c.standing ? "warn" : undefined} />
                  <Mini label="Extra" value={hrs(c.extra)} tone={c.extra ? "info" : undefined} />
                  <Mini label="Issues" value={c.open_issues ? `${c.issues} (${c.open_issues} open)` : String(c.issues)} tone={c.open_issues ? "warn" : undefined} />
                </div>
              </Link>
            ))}
          </div>
        ) : <Empty>Nothing recorded in these dates.</Empty>}
      </section>
      )}
    </div>
  );
}

function addDays(s: string, n: number) { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "info" }) {
  return (
    <Card className="p-4">
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className={cn("tabular mt-1 text-[26px] font-semibold leading-none", tone === "warn" && "text-warn", tone === "info" && "text-info")}>{value}</p>
    </Card>
  );
}
function Mini({ label, value, tone }: { label: string; value: string; tone?: "warn" | "info" }) {
  return (
    <div className="rounded-lg bg-paper px-1 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("tabular text-[15px] font-semibold", tone === "warn" && "text-warn", tone === "info" && "text-info")}>{value}</p>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <Card className="px-4 py-6 text-center text-[14px] text-muted">{children}</Card>;
}
