import type { Metadata } from "next";
import Link from "next/link";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { groupDaywork, qsFilterOptions, qsSummary } from "@/server/queries/qs";
import { londonToday } from "@/server/queries/timesheets";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { DAYS, tradeLabel } from "@/lib/handover";
import { formatDate, formatDateTime, formatShortDate } from "@/lib/format";
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
  const standing = companies.reduce((s, c) => s + c.standing, 0);
  const extra = companies.reduce((s, c) => s + c.extra, 0);
  const sheets = companies.reduce((s, c) => s + c.sheets.length, 0);
  const driving = data.travel.reduce((s, t) => s + t.driving_minutes, 0) / 60;
  const qs = (o: Partial<Params>) => {
    const q = new URLSearchParams({ from: f.from, to: f.to, ...(f.jobId ? { job: f.jobId } : {}), ...(f.companyId ? { company: f.companyId } : {}), ...o });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return q.toString();
  };

  return (
    <div className="grid gap-6">
      <PageHeader title="QS check"
        description="Everything recorded on site for the dates below — daywork hours (standing time and extra work), deliveries, handovers and MSW travel — to check against subcontractor invoices. Hours and counts only."
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Standing time" value={hrs(standing)} tone="warn" />
        <Stat label="Extra work" value={hrs(extra)} tone="info" />
        <Stat label="Daywork sheets" value={String(sheets)} />
        <Stat label="Deliveries" value={String(data.deliveries.length)} />
        <Stat label="Handovers" value={String(data.handovers.length)} />
        <Stat label="MSW driving" value={hrs(driving)} />
      </div>

      <section>
        <SectionTitle>Daywork by company</SectionTitle>
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
        ) : <Empty>No daywork in these dates.</Empty>}
      </section>

      <section>
        <SectionTitle>Deliveries · {data.deliveries.length}</SectionTitle>
        {data.deliveries.length ? (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13.5px]">
              <thead><tr className="border-b border-line text-left text-muted"><th className="px-4 py-2 font-semibold">Date</th><th className="pr-4 font-semibold">Job</th><th className="pr-4 font-semibold">What</th><th className="pr-4 font-semibold">Delivered by</th><th className="pr-4 font-semibold">Received by</th></tr></thead>
              <tbody>
                {data.deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0 align-top">
                    <td className="px-4 py-2 whitespace-nowrap"><Link href={`/office/deliveries/${d.id}`} className="underline">{formatDateTime(d.signed_at)}</Link></td>
                    <td className="py-2 pr-4 font-mono whitespace-nowrap">{d.job_number}</td>
                    <td className="py-2 pr-4">{d.items.map((i, n) => <span key={n} className="block">{i.quantity ? `${i.quantity} × ` : ""}{i.description}</span>)}{d.notes && <span className="block text-warn">Note: {d.notes}</span>}</td>
                    <td className="py-2 pr-4">{d.delivered_by}{d.vehicle_reg ? ` · ${d.vehicle_reg}` : ""}<span className="block text-muted">{d.company}</span></td>
                    <td className="py-2 pr-4">{d.receiver_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : <Empty>No deliveries in these dates.</Empty>}
      </section>

      <section>
        <SectionTitle>Handovers · {data.handovers.length}</SectionTitle>
        {data.handovers.length ? (
          <Card className="divide-y divide-line">
            {data.handovers.map((h) => (
              <Link key={h.id} href={`/office/handovers/${h.id}`} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5 text-[14px] hover:bg-paper">
                <span className="w-28 text-muted">{formatShortDate(h.signed_at.slice(0, 10))}</span>
                <span className="font-mono text-[13px]">{h.job_number}</span>
                <span className="font-medium">{h.title}</span>
                <span className="text-muted">{h.scopes.map(tradeLabel).join(", ")} · {h.company}</span>
              </Link>
            ))}
          </Card>
        ) : <Empty>No handovers in these dates.</Empty>}
      </section>

      <section>
        <SectionTitle>MSW driving &amp; travel</SectionTitle>
        <p className="-mt-1 mb-2 text-[13px] text-muted">From MSW&apos;s own operatives&apos; timesheets — not on subcontractor invoices.</p>
        {data.travel.length ? (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead><tr className="border-b border-line text-left text-muted"><th className="px-4 py-2 font-semibold">Operative</th><th className="text-right font-semibold">Days</th><th className="text-right font-semibold">Driving</th><th className="text-right font-semibold">Passenger</th><th className="text-right font-semibold">On site</th><th className="text-right font-semibold">Miles</th><th className="pr-4 text-right font-semibold">Not yet approved</th></tr></thead>
              <tbody>
                {data.travel.map((t) => (
                  <tr key={t.user_id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 font-medium">{t.full_name}</td>
                    <td className="tabular text-right">{t.days}</td>
                    <td className="tabular text-right font-semibold">{hrs(t.driving_minutes / 60)}</td>
                    <td className="tabular text-right">{hrs(t.passenger_minutes / 60)}</td>
                    <td className="tabular text-right">{hrs(t.site_minutes / 60)}</td>
                    <td className="tabular text-right">{t.miles}</td>
                    <td className={cn("tabular pr-4 text-right", t.unapproved && "font-semibold text-warn")}>{t.unapproved || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : <Empty>No timesheets in these dates.</Empty>}
      </section>
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
function Empty({ children }: { children: React.ReactNode }) {
  return <Card className="px-4 py-6 text-center text-[14px] text-muted">{children}</Card>;
}
