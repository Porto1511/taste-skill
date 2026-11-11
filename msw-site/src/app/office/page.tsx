import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Buildings, WarningCircle, Siren, ClockCounterClockwise, FileDashed, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { getDashboard } from "@/server/queries/office";
import { Card, SectionTitle, Stat } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ActivityFeed } from "@/components/office/activity-feed";
import { JobTiles } from "@/components/office/job-tiles";
import { ReportTable } from "@/components/office/report-table";
import { requestNow } from "@/lib/now";

export const metadata: Metadata = { title: "Dashboard" };

const more = "text-sm font-semibold text-brand hover:underline";

export default async function OfficeDashboard() {
  const viewer = await requireStaff();
  const d = await getDashboard(viewer);
  const now = requestNow();
  const s = d.stats;
  const summary = [
    `${s.live_jobs} live job${s.live_jobs === 1 ? "" : "s"}`,
    s.open_issues ? `${s.open_issues} open issue${s.open_issues === 1 ? "" : "s"}` : "no open issues",
    s.drafts_pending ? `${s.drafts_pending} drawing${s.drafts_pending === 1 ? "" : "s"} waiting for approval` : null,
  ].filter(Boolean).join(" · ");
  return (
    <div>
      <section className="glass-dark relative mb-6 overflow-hidden rounded-[2rem] px-6 py-7 text-white sm:px-9 sm:py-9">
        <span className="orb -right-10 -top-24 size-80 bg-brand/40" aria-hidden />
        <span className="orb -bottom-28 left-1/3 size-72 bg-signal/15" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="w-fit rounded-full bg-white/[0.08] px-3 py-1 text-[12px] font-medium uppercase tracking-[0.16em] text-white/80 ring-1 ring-white/10">
              {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date(now))}
            </p>
            <h1 className="mt-4 text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[44px]">Good to see you, {viewer.fullName.split(" ")[0]}</h1>
            <p className="mt-2 text-[16px] text-white/75">{summary}</p>
          </div>
          {viewer.isAdmin && <ButtonLink href="/office/jobs/new" variant="primary" size="lg"><Plus className="size-5" weight="bold" /> New job</ButtonLink>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Live jobs" value={s.live_jobs} icon={<Buildings />} href="/office/jobs?status=live" />
        <Stat label="Open issues" value={s.open_issues} icon={<WarningCircle />} tone={s.open_issues ? "warn" : undefined} href="/office/reports?status=active" />
        <Stat label="Urgent / safety" value={s.urgent_open} icon={<Siren />} tone={s.urgent_open ? "danger" : "ok"} href="/office/reports?status=active&priority=urgent" />
        <Stat label="Reports, 24h" value={s.reports_24h} icon={<ClockCounterClockwise />} href="/office/reports" />
        <Stat label="Drafts to approve" value={s.drafts_pending} icon={<FileDashed />} hint="Not on site yet" />
        <Stat label="People on live jobs" value={s.people_on_live_jobs} icon={<UsersThree />} href="/office/people" />
      </div>

      <section className="mt-8">
        <SectionTitle action={<Link href="/office/jobs" className={more}>All jobs →</Link>}>Jobs</SectionTitle>
        <JobTiles jobs={d.jobs} now={now} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle action={<Link href="/office/reports?status=active" className={more}>All open issues →</Link>}>Needs attention</SectionTitle>
          <Card className="overflow-hidden"><ReportTable reports={d.openIssues} now={now} /></Card>
        </section>
        <section>
          <SectionTitle action={<Link href="/office/activity" className={more}>Full history →</Link>}>Recent activity</SectionTitle>
          <Card className="overflow-hidden"><ActivityFeed items={d.activity} now={now} dense /></Card>
        </section>
      </div>
    </div>
  );
}
