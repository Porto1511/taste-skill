import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getPerson } from "@/server/queries/office";
import { config } from "@/server/config";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/form";
import { Badge, JobStatusBadge } from "@/components/ui/badge";
import { ActivityFeed } from "@/components/office/activity-feed";
import { EditPersonForm, PersonAccountControls } from "@/components/office/people-forms";
import { dateRange, formatDate, labels, relativeTime, telHref } from "@/lib/format";
import { requestNow } from "@/lib/now";

export default async function PersonPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ invited?: string }> }) {
  const viewer = await requireStaff();
  const { userId } = await params;
  const { invited } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  const data = await getPerson(viewer, userId);
  if (!data) notFound();
  const { person: p, assignments, activity, companies } = data;
  const active = assignments.filter((a) => !a.revoked_at);
  const past = assignments.filter((a) => a.revoked_at);
  const staff = p.role === "admin" || p.role === "office";
  return (
    <div>
      <PageHeader back={{ href: `/office/people/companies/${p.company_id}`, label: p.company_name }} title={p.full_name}
        eyebrow={<span className="flex items-center gap-2">{labels.role[p.role]}{!p.active && <Badge tone="danger">Deactivated</Badge>}</span>}
        description={<>{p.job_title ? `${p.job_title} · ` : ""}{p.email}{p.phone && <> · <a className="font-medium text-ink hover:underline" href={telHref(p.phone)}>{p.phone}</a></>}</>} />
      {invited && <Alert tone="ok" className="mb-4" title="Invitation sent">Allocate them to jobs below via each job&apos;s People &amp; access tab.</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-6">
          <section>
            <SectionTitle>Job access</SectionTitle>
            {staff ? (
              <Alert tone="info">MSW office users can see every job.</Alert>
            ) : (
              <Card className="divide-y divide-line overflow-hidden">
                {active.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">Not allocated to any job — they see an empty My Jobs screen.</p>}
                {active.map((a) => (
                  <Link key={a.id} href={`/office/jobs/${a.job_id}/access`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-paper">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold"><span className="font-mono text-[13px] text-muted">{a.job_number}</span> {a.job_name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {a.all_areas ? <Badge tone="dark">All areas</Badge> : a.area_names.length ? a.area_names.map((n) => <Badge key={n} tone="signal">{n}</Badge>) : <Badge>Job-wide only</Badge>}
                        {a.can_view_company_reports && <Badge tone="info">Company reports</Badge>}
                      </div>
                    </div>
                    <div className="text-right text-[13px] text-muted"><JobStatusBadge status={a.job_status} /><p className="mt-1">{dateRange(a.attendance_from, a.attendance_to) ?? `Since ${formatDate(a.granted_at)}`}</p></div>
                  </Link>
                ))}
              </Card>
            )}
            {past.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-muted">Previous jobs · {past.length}</summary>
                <Card className="mt-2 divide-y divide-line">
                  {past.map((a) => <p key={a.id} className="px-4 py-2 text-[14px]"><span className="font-mono text-[12px] text-muted">{a.job_number}</span> {a.job_name} <span className="text-[12px] text-muted">· ended {formatDate(a.revoked_at)}</span></p>)}
                </Card>
              </details>
            )}
          </section>
          <section>
            <SectionTitle>Recent activity</SectionTitle>
            <Card className="overflow-hidden"><ActivityFeed items={activity} now={requestNow()} dense /></Card>
          </section>
        </div>
        <aside className="grid content-start gap-6">
          <Card className="p-4 text-[13px] text-muted">
            Last seen: <span className="font-medium text-ink">{p.last_seen_at ? relativeTime(p.last_seen_at) : "never signed in"}</span><br />
            Account created {formatDate(p.created_at)}
          </Card>
          {viewer.isAdmin ? (
            <>
              <section><SectionTitle>Details</SectionTitle><Card className="p-5"><EditPersonForm person={p} companies={companies} isSelf={p.id === viewer.id} /></Card></section>
              <section><SectionTitle>Account</SectionTitle><Card className="p-5"><PersonAccountControls userId={p.id} active={p.active} isSelf={p.id === viewer.id} demo={config.isDemo} /></Card></section>
            </>
          ) : <Alert tone="info">Only MSW administrators can edit people.</Alert>}
        </aside>
      </div>
    </div>
  );
}
