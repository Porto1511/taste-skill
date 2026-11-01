import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone, NavigationArrow, Certificate, WarningOctagon, TrendUp, Camera, Info, StackSimple, CalendarBlank,
  UserCircle, Buildings, MapPin, ArrowSquareOut, ShieldWarning,
} from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { getSiteJob } from "@/server/queries/site";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/ui/badge";
import { DocumentList } from "@/components/site/document-list";
import { PhotoGrid } from "@/components/site/photo-grid";
import { ReportRow } from "@/components/site/report-row";
import { dateRange, formatDate, mapsHref, relativeTime, telHref } from "@/lib/format";
import { requestNow } from "@/lib/now";

type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await requireViewer();
  const data = await getSiteJob(viewer, (await params).jobId).catch(() => null);
  return { title: data ? data.job.name : "Job" };
}

export default async function SiteJobPage({ params }: Props) {
  const viewer = await requireViewer();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const data = await getSiteJob(viewer, jobId);
  if (!data) notFound(); // not allocated: indistinguishable from "does not exist"

  const { job, assignment, areas, office, documents, reports, photos } = data;
  const now = requestNow();
  const drawings = documents.filter((d) => d.kind === "drawing");
  const rams = documents.filter((d) => d.kind === "rams");
  const allAreas = viewer.isStaff || assignment?.all_areas;
  const attendance = assignment ? dateRange(assignment.attendance_from, assignment.attendance_to) : null;
  const isManagerView = viewer.role === "manager";
  const myReports = reports.filter((r) => r.author_id === viewer.id);
  const otherReports = reports.filter((r) => r.author_id !== viewer.id);

  return (
    <div className="grid gap-7">
      {/* Header */}
      <header>
        <Link href="/jobs" className="mb-3 inline-flex text-sm font-medium text-muted hover:text-ink">‹ My jobs</Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[14px] font-semibold text-muted">{job.job_number}</span>
          <JobStatusBadge status={job.status} />
        </div>
        <h1 className="mt-1 text-[28px] font-semibold leading-[1.15] tracking-tight">{job.name}</h1>
        {job.main_contractor && (
          <p className="mt-1.5 flex items-center gap-1.5 text-muted"><Buildings className="size-4" /> {job.main_contractor}</p>
        )}
        {(job.status === "on_hold" || job.status === "complete") && (
          <div className="mt-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm font-medium text-[#6b3300]">
            {job.status === "on_hold" ? "This job is ON HOLD. Do not attend site unless the MSW office tells you to." : "This job is complete."}
          </div>
        )}
      </header>

      {/* Allocation */}
      <Card className="flex items-start gap-3 border-ink/10 bg-ink p-4 text-white">
        <StackSimple className="mt-0.5 size-6 shrink-0 text-signal" weight="duotone" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">{isManagerView ? "Your access" : "Your allocated area"}</p>
          <p className="mt-0.5 text-[18px] font-semibold">
            {allAreas ? "All areas" : areas.length ? areas.map((a) => a.name).join(" · ") : "Job-wide information only"}
          </p>
          {attendance && <p className="mt-1 flex items-center gap-1.5 text-[14px] text-white/75"><CalendarBlank className="size-4" /> Attendance: {attendance}</p>}
          {assignment?.note && <p className="mt-1 text-[14px] text-white/60">{assignment.note}</p>}
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5">
        {job.site_contact_phone ? (
          <ButtonLink href={telHref(job.site_contact_phone)} variant="dark" size="xl" className="h-auto flex-col gap-1 py-3.5">
            <Phone className="size-6" weight="fill" />
            <span className="text-[15px]">Call site</span>
            <span className="text-[12px] font-medium text-white/60">{job.site_contact_name ?? job.site_contact_phone}</span>
          </ButtonLink>
        ) : (
          <div className="grid place-items-center rounded-xl border border-dashed border-line-strong p-3 text-center text-[13px] text-muted">No site phone recorded</div>
        )}
        <ButtonLink href={mapsHref(job.site_address, job.postcode)} variant="secondary" size="xl" className="h-auto flex-col gap-1 py-3.5">
          <NavigationArrow className="size-6" weight="fill" />
          <span className="text-[15px]">Directions</span>
          <span className="text-[12px] font-medium text-muted">{job.postcode ?? "Open maps"}</span>
        </ButtonLink>
        <ButtonLink href={`/jobs/${job.id}/report?kind=issue`} variant="primary" size="xl" className="h-auto flex-col gap-1 py-3.5">
          <WarningOctagon className="size-6" weight="fill" />
          <span className="text-[15px]">Report an issue</span>
        </ButtonLink>
        <ButtonLink href={`/jobs/${job.id}/report?kind=progress`} variant="secondary" size="xl" className="h-auto flex-col gap-1 py-3.5">
          <TrendUp className="size-6" weight="bold" />
          <span className="text-[15px]">Progress update</span>
        </ButtonLink>
      </div>

      {/* Induction */}
      {job.induction_url && (
        <a href={job.induction_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-[var(--radius-card)] border border-signal/50 bg-signal-soft p-4 transition-colors hover:border-signal">
          <Certificate className="size-7 shrink-0 text-signal-ink" weight="duotone" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Online site induction</span>
            <span className="block text-[14px] text-[#6b3a00]">{job.induction_notes ?? "Complete before your first day on site."}</span>
          </span>
          <ArrowSquareOut className="size-5 shrink-0 text-signal-ink" />
        </a>
      )}

      {/* Site instructions */}
      {job.site_instructions && (
        <section aria-labelledby="instructions">
          <SectionTitle id="instructions" action={<span className="text-[12px] text-subtle">Updated {relativeTime(job.updated_at, now)}</span>}>Site instructions</SectionTitle>
          <Card className="p-4">
            <div className="whitespace-pre-line text-[15px] leading-relaxed">{job.site_instructions}</div>
          </Card>
        </section>
      )}

      {/* Drawings */}
      <section aria-labelledby="drawings">
        <SectionTitle id="drawings" action={<span className="text-[12px] font-medium text-subtle">Approved for construction only</span>}>
          Drawings · {drawings.length}
        </SectionTitle>
        {drawings.length ? (
          <DocumentList jobId={job.id} documents={drawings} areas={areas} kind="drawing" now={now} />
        ) : (
          <EmptyState title="No current drawings for your area">MSW will publish drawings here once they are approved for construction.</EmptyState>
        )}
      </section>

      {/* RAMS */}
      <section aria-labelledby="rams">
        <SectionTitle id="rams">RAMS · {rams.length}</SectionTitle>
        {rams.length ? (
          <DocumentList jobId={job.id} documents={rams} areas={areas} kind="rams" now={now} />
        ) : (
          <EmptyState title="No RAMS published yet" />
        )}
        <p className="mt-2 flex gap-2 text-[13px] leading-snug text-muted">
          <ShieldWarning className="mt-0.5 size-4 shrink-0" />
          The digital RAMS is for reference. You must still attend the site briefing and sign the hard-copy RAMS as required on site.
        </p>
      </section>

      {/* Reports */}
      <section aria-labelledby="reports">
        <SectionTitle id="reports">{isManagerView && assignment?.can_view_company_reports ? "Reports from your company" : "My reports & updates"}</SectionTitle>
        {(isManagerView ? reports : myReports).length ? (
          <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
            {(isManagerView ? reports : myReports).map((r) => (
              <ReportRow key={r.id} report={r} href={`/jobs/${job.id}/reports/${r.id}`} showAuthor={isManagerView} now={now} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing reported yet">Report issues and progress from site — the MSW office is notified straight away.</EmptyState>
        )}
        {!isManagerView && otherReports.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[13px] font-semibold text-muted">Shared with your team by MSW</p>
            <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
              {otherReports.map((r) => <ReportRow key={r.id} report={r} href={`/jobs/${job.id}/reports/${r.id}`} showAuthor now={now} />)}
            </div>
          </div>
        )}
      </section>

      {/* Photos */}
      <section aria-labelledby="photos">
        <SectionTitle id="photos" action={
          <Link href={`/jobs/${job.id}/report?kind=photo`} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-card px-3 py-1.5 text-[13px] font-semibold hover:border-ink/40">
            <Camera className="size-4" /> Add photos
          </Link>
        }>Site photos · {photos.length}</SectionTitle>
        {photos.length ? (
          <PhotoGrid photos={photos.map((p) => ({ id: p.id, caption: p.caption, meta: `${p.report_title}${p.area_name ? ` · ${p.area_name}` : ""} · ${formatDate(p.created_at)}` }))} />
        ) : (
          <EmptyState icon={<Camera />} title="No photos yet">Photos you upload, and photos MSW shares with your team, appear here.</EmptyState>
        )}
      </section>

      {/* Site details */}
      <section aria-labelledby="details">
        <SectionTitle id="details">Site details</SectionTitle>
        <Card className="divide-y divide-line">
          <Detail icon={<MapPin />} label="Site address">
            <p>{job.site_address}{job.postcode ? `, ${job.postcode}` : ""}</p>
            {job.what3words && <p className="font-mono text-sm text-muted">{job.what3words}</p>}
            {job.directions && <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-muted">{job.directions}</p>}
          </Detail>
          {job.site_contact_name && (
            <Detail icon={<UserCircle />} label="Site contact">
              <p className="font-medium">{job.site_contact_name}</p>
              {job.site_contact_role && <p className="text-sm text-muted">{job.site_contact_role}</p>}
              {job.site_contact_phone && <a href={telHref(job.site_contact_phone)} className="mt-1 inline-block font-semibold text-signal-ink underline-offset-2 hover:underline">{job.site_contact_phone}</a>}
            </Detail>
          )}
          {office && (
            <Detail icon={<Buildings />} label="MSW contact">
              <p className="font-medium">{office.full_name}</p>
              {office.job_title && <p className="text-sm text-muted">{office.job_title}</p>}
              {office.phone && <a href={telHref(office.phone)} className="mt-1 inline-block font-semibold text-signal-ink underline-offset-2 hover:underline">{office.phone}</a>}
            </Detail>
          )}
          {(job.start_date || job.end_date) && (
            <Detail icon={<CalendarBlank />} label="Programme">
              <p>{dateRange(job.start_date, job.end_date)}</p>
            </Detail>
          )}
        </Card>
      </section>

      <p className="flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-[13px] leading-snug text-[#7a1810]">
        <Info className="mt-0.5 size-4 shrink-0" weight="bold" />
        For urgent safety issues, make the area safe and phone the site manager or your supervisor immediately. Reporting in MSW Site is in addition to, never instead of, speaking to someone.
      </p>
    </div>
  );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4">
      <span className="mt-0.5 text-muted [&_svg]:size-5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
