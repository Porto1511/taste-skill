import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { getDashboard } from "@/server/queries/office";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle, Stat } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ActivityFeed } from "@/components/office/activity-feed";
import { JobsTable } from "@/components/office/jobs-table";
import { ReportTable } from "@/components/office/report-table";
import { requestNow } from "@/lib/now";

export const metadata: Metadata = { title: "Dashboard" };

export default async function OfficeDashboard() {
  const viewer = await requireStaff();
  const d = await getDashboard(viewer);
  const now = requestNow();
  return (
    <div>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date())}
        title={`Good to see you, ${viewer.fullName.split(" ")[0]}`}
        actions={<ButtonLink href="/office/jobs/new" variant="primary"><Plus className="size-5" weight="bold" /> New job</ButtonLink>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Live jobs" value={d.stats.live_jobs} href="/office/jobs?status=live" />
        <Stat label="Open issues" value={d.stats.open_issues} tone={d.stats.open_issues ? "warn" : undefined} href="/office/reports?status=active" />
        <Stat label="Urgent / safety" value={d.stats.urgent_open} tone={d.stats.urgent_open ? "danger" : "ok"} href="/office/reports?status=active&priority=urgent" />
        <Stat label="Reports, last 24h" value={d.stats.reports_24h} href="/office/reports" />
        <Stat label="Drafts awaiting approval" value={d.stats.drafts_pending} hint="Not visible on site" />
        <Stat label="People on live jobs" value={d.stats.people_on_live_jobs} href="/office/people" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle action={<Link href="/office/reports?status=active" className="text-sm font-semibold text-signal-ink hover:underline">All open issues →</Link>}>Needs attention</SectionTitle>
          <Card className="overflow-hidden"><ReportTable reports={d.openIssues} now={now} /></Card>
        </section>
        <section>
          <SectionTitle action={<Link href="/office/activity" className="text-sm font-semibold text-signal-ink hover:underline">Full history →</Link>}>Recent activity</SectionTitle>
          <Card className="overflow-hidden"><ActivityFeed items={d.activity} now={now} dense /></Card>
        </section>
      </div>

      <section className="mt-8">
        <SectionTitle action={<Link href="/office/jobs" className="text-sm font-semibold text-signal-ink hover:underline">All jobs →</Link>}>Active jobs</SectionTitle>
        <Card className="overflow-hidden"><JobsTable jobs={d.jobs} now={now} /></Card>
      </section>
    </div>
  );
}
