import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone, NavigationArrow, WarningOctagon, Signature, Certificate, ArrowSquareOut, ShieldWarning, MapPin, UserCircle,
  Buildings, CalendarBlank, TrendUp, Camera, CaretLeft, CaretRight,
} from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { getSiteJob } from "@/server/queries/site";
import { listHandovers } from "@/server/queries/handovers";
import { EmptyState } from "@/components/ui/card";
import { DocumentList } from "@/components/site/document-list";
import { PhotoGrid } from "@/components/site/photo-grid";
import { ReportRow } from "@/components/site/report-row";
import { JobTabs } from "@/components/site/job-tabs";
import { dateRange, formatDate, mapsHref, relativeTime, telHref } from "@/lib/format";
import { requestNow } from "@/lib/now";
import { cn } from "@/lib/cn";

type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await requireViewer();
  const data = await getSiteJob(viewer, (await params).jobId).catch(() => null);
  return { title: data ? data.job.name : "Job" };
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({ href, icon, label, sub, tone = "light" }: { href: string; icon: React.ReactNode; label: string; sub?: string; tone?: "light" | "signal" | "dark" }) {
  const external = href.startsWith("http") || href.startsWith("tel:");
  const cls = cn(
    "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center transition-transform active:scale-[0.97] [&_svg]:size-7",
    tone === "signal" ? "bg-signal text-ink" : tone === "dark" ? "bg-ink text-white" : "border border-line bg-card text-ink shadow-[var(--shadow-card)]",
  );
  const body = (
    <>
      {icon}
      <span className="text-[12.5px] font-bold leading-tight">{label}</span>
      {sub && <span className={cn("max-w-full truncate text-[10.5px] font-medium", tone === "dark" ? "text-white/60" : "text-muted")}>{sub}</span>}
    </>
  );
  return external
    ? <a href={href} className={cls} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{body}</a>
    : <Link href={href} className={cls}>{body}</Link>;
}

export default async function SiteJobPage({ params }: Props) {
  const viewer = await requireViewer();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const data = await getSiteJob(viewer, jobId);
  if (!data) notFound(); // not allocated, or not live: indistinguishable from "does not exist"
  const handovers = await listHandovers(viewer, jobId);

  const { job, assignment, areas, office, documents, reports, photos } = data;
  const now = requestNow();
  const drawings = documents.filter((d) => d.kind === "drawing");
  const rams = documents.filter((d) => d.kind === "rams");
  const allAreas = viewer.isStaff || assignment?.all_areas;
  const attendance = assignment ? dateRange(assignment.attendance_from, assignment.attendance_to) : null;
  const isManager = viewer.role === "manager";
  const mine = isManager ? reports : reports.filter((r) => r.author_id === viewer.id);
  const shared = isManager ? [] : reports.filter((r) => r.author_id !== viewer.id);
  const areaChips = allAreas ? ["All areas"] : areas.length ? areas.map((a) => a.name) : ["Job info only"];

  const listCls = "divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]";

  return (
    <div>
      <Link href="/jobs" className="-ml-1 mb-2 inline-flex items-center gap-0.5 text-[13px] font-semibold text-muted"><CaretLeft className="size-4" weight="bold" /> Your jobs</Link>

      <header className="rounded-2xl bg-ink p-4 text-white">
        <p className="font-mono text-[12px] text-white/55">{job.job_number}{job.main_contractor ? ` · ${job.main_contractor.replace(/ \(fictional\)$/, "")}` : ""}</p>
        <h1 className="mt-1 text-[21px] font-semibold leading-tight tracking-tight">{job.name}</h1>
        <a href={mapsHref(job.site_address, job.postcode)} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-start gap-1.5 text-[13px] text-white/70">
          <MapPin className="mt-0.5 size-4 shrink-0" />{job.site_address}{job.postcode ? `, ${job.postcode}` : ""}
        </a>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">{isManager ? "Access" : "Your area"}</span>
          {areaChips.map((a) => <span key={a} className="rounded-md bg-signal px-2 py-0.5 text-[12.5px] font-bold text-ink">{a}</span>)}
        </div>
        {(attendance || assignment?.note) && (
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-white/60">
            {attendance && <><CalendarBlank className="size-4" />{attendance}</>}{attendance && assignment?.note ? " · " : ""}{assignment?.note}
          </p>
        )}
      </header>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {job.site_contact_phone
          ? <Tile href={telHref(job.site_contact_phone)} icon={<Phone weight="fill" />} label="Call site" sub={job.site_contact_name?.split(" ")[0] ?? undefined} tone="dark" />
          : <Tile href="#info" icon={<Phone />} label="No phone" />}
        <Tile href={mapsHref(job.site_address, job.postcode)} icon={<NavigationArrow weight="fill" />} label="Directions" sub={job.postcode ?? undefined} />
        <Tile href={`/jobs/${job.id}/report?kind=issue`} icon={<WarningOctagon weight="fill" />} label="Report issue" tone="signal" />
        <Tile href={`/jobs/${job.id}/handover`} icon={<Signature weight="bold" />} label="Handover" sub="Get it signed" />
      </div>

      {job.induction_url && (
        <a href={job.induction_url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-3 rounded-2xl border border-signal/60 bg-signal-soft px-4 py-3">
          <Certificate className="size-6 shrink-0 text-signal-ink" weight="duotone" />
          <span className="min-w-0 flex-1 text-[14px] font-semibold">Online site induction<span className="block text-[12px] font-medium text-[#6b3a00]">Do this before your first day</span></span>
          <ArrowSquareOut className="size-5 shrink-0 text-signal-ink" />
        </a>
      )}

      <div className="mt-2">
        <JobTabs tabs={[
          {
            id: "drawings", label: "Drawings", count: drawings.length,
            content: drawings.length
              ? <DocumentList jobId={job.id} documents={drawings} areas={areas} kind="drawing" now={now} />
              : <EmptyState title="No drawings issued for your area yet">They appear here once MSW approves them for construction.</EmptyState>,
          },
          {
            id: "rams", label: "RAMS", count: rams.length,
            content: (
              <>
                {rams.length ? <DocumentList jobId={job.id} documents={rams} areas={areas} kind="rams" now={now} /> : <EmptyState title="No RAMS published yet" />}
                <p className="mt-3 flex gap-2 text-[12.5px] leading-snug text-muted">
                  <ShieldWarning className="mt-0.5 size-4 shrink-0" />
                  For reference. You still need the site briefing and to sign the hard-copy RAMS.
                </p>
              </>
            ),
          },
          {
            id: "info", label: "Info",
            content: (
              <>
                {job.site_instructions && (
                  <Section title="Site instructions" action={<span className="text-[11px] text-subtle">Updated {relativeTime(job.updated_at, now)}</span>}>
                    <div className="whitespace-pre-line rounded-2xl border border-line bg-card p-4 text-[15px] leading-relaxed shadow-[var(--shadow-card)]">{job.site_instructions}</div>
                  </Section>
                )}
                <Section title="Getting there">
                  <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
                    <p className="font-medium">{job.site_address}{job.postcode ? `, ${job.postcode}` : ""}</p>
                    {job.what3words && <p className="font-mono text-sm text-muted">{job.what3words}</p>}
                    {job.directions && <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-muted">{job.directions}</p>}
                  </div>
                </Section>
                <Section title="Contacts">
                  <div className={listCls}>
                    {job.site_contact_name && (
                      <Contact icon={<UserCircle />} name={job.site_contact_name} role={job.site_contact_role} phone={job.site_contact_phone} />
                    )}
                    {office && <Contact icon={<Buildings />} name={office.full_name} role={`MSW · ${office.job_title ?? "Office"}`} phone={office.phone} />}
                  </div>
                </Section>
                {(job.start_date || job.end_date) && (
                  <p className="mb-5 text-[13px] text-muted">Programme: {dateRange(job.start_date, job.end_date)}</p>
                )}
                <p className="rounded-xl bg-danger-soft px-4 py-3 text-[13px] leading-snug text-[#7a1810]">
                  Urgent safety issue? Make the area safe and phone the site manager or your supervisor straight away. Reporting in the app is in addition to speaking to someone.
                </p>
              </>
            ),
          },
          {
            id: "reports", label: "Reports", count: mine.length + handovers.length || undefined,
            content: (
              <>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <Link href={`/jobs/${job.id}/report?kind=progress`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-[14px] font-semibold"><TrendUp className="size-5" weight="bold" /> Progress update</Link>
                  <Link href={`/jobs/${job.id}/report?kind=photo`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-[14px] font-semibold"><Camera className="size-5" /> Upload photos</Link>
                </div>
                <Section title={isManager ? "Your company's reports" : "Your reports"}>
                  {mine.length
                    ? <div className={listCls}>{mine.map((r) => <ReportRow key={r.id} report={r} href={`/jobs/${job.id}/reports/${r.id}`} showAuthor={isManager} now={now} />)}</div>
                    : <EmptyState title="Nothing reported yet">Issues and progress you send appear here with the office&apos;s replies.</EmptyState>}
                </Section>
                {shared.length > 0 && (
                  <Section title="Shared with your team">
                    <div className={listCls}>{shared.map((r) => <ReportRow key={r.id} report={r} href={`/jobs/${job.id}/reports/${r.id}`} showAuthor now={now} />)}</div>
                  </Section>
                )}
                <Section title="Handovers signed" action={<Link href={`/jobs/${job.id}/handover`} className="text-[13px] font-semibold text-signal-ink">+ New</Link>}>
                  {handovers.length ? (
                    <div className={listCls}>
                      {handovers.map((h) => (
                        <Link key={h.id} href={`/jobs/${job.id}/handovers/${h.id}`} className="flex items-center gap-3 px-4 py-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok"><Signature className="size-5" weight="bold" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold leading-snug">{h.title}</span>
                            <span className="block text-[12.5px] text-muted">{h.signer_name} · {formatDate(h.signed_at)}</span>
                          </span>
                          <CaretRight className="size-4 text-subtle" weight="bold" />
                        </Link>
                      ))}
                    </div>
                  ) : <p className="text-[13px] text-muted">None yet for your areas.</p>}
                </Section>
              </>
            ),
          },
          {
            id: "photos", label: "Photos", count: photos.length,
            content: photos.length ? (
              <>
                <PhotoGrid photos={photos.map((p) => ({ id: p.id, caption: p.caption, meta: `${p.report_title}${p.area_name ? ` · ${p.area_name}` : ""} · ${formatDate(p.created_at)}` }))} />
                <Link href={`/jobs/${job.id}/report?kind=photo`} className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white"><Camera className="size-5" weight="fill" /> Add photos</Link>
              </>
            ) : (
              <EmptyState icon={<Camera />} title="No photos yet" action={<Link href={`/jobs/${job.id}/report?kind=photo`} className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 font-semibold text-white"><Camera className="size-5" weight="fill" /> Take photos</Link>} />
            ),
          },
        ]} />
      </div>
    </div>
  );
}

function Contact({ icon, name, role, phone }: { icon: React.ReactNode; name: string; role: string | null; phone: string | null }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-muted [&_svg]:size-6">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{name}</span>{role && <span className="block text-[12.5px] text-muted">{role}</span>}</span>
      {phone && <a href={telHref(phone)} className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-3 text-[13px] font-semibold text-white"><Phone className="size-4" weight="fill" /> Call</a>}
    </div>
  );
}
