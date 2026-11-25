import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getSiteVisit } from "@/server/queries/site-visits";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { ShareCopy } from "@/components/handover/share-copy";
import { BlockerToggle, DeleteVisitButton } from "@/components/site-visits/visit-controls";
import { ReadyBadge } from "@/components/site-visits/ready-badge";
import { ANSWERS, AREA_STATUS, BLOCKER_OWNERS, BLOCKER_SEVERITY, CHECKLIST, VISIT_TYPES, labelOf } from "@/lib/site-visit";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Site visit" };

const answerTone = (a: string | null | undefined) => (a === "yes" ? "text-ok" : a === "no" ? "text-danger" : a === "partial" ? "text-warn" : "text-muted");

export default async function SiteVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await getSiteVisit(viewer, id);
  if (!v) notFound();
  const pdf = `/api/site-visits/${v.id}/report`;
  return (
    <div className="max-w-4xl">
      <PageHeader back={{ href: "/office/site-visits", label: "Site visits" }}
        eyebrow={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{v.job_number}</span><ReadyBadge ready={v.ready} /></span>}
        title={v.job_name ?? v.site_address}
        description={<>{v.site_address} · {formatDate(v.visit_date)} · {labelOf(VISIT_TYPES, v.visit_type)} by {v.visited_by_name}{v.met_name ? ` · met ${v.met_name}${v.met_phone ? ` (${v.met_phone})` : ""}` : ""}{v.job_id && <> · <Link href={`/office/jobs/${v.job_id}`} className="underline">open job</Link></>}</>} />

      <div className="grid gap-6">
        <Card className="grid gap-3 p-5 sm:grid-cols-[1fr_280px]">
          <div className="grid gap-1 text-[15px]">
            {v.conditions && <p><span className="font-semibold">Ready if: </span>{v.conditions}</p>}
            <p><span className="text-muted">Proposed start: </span><span className="font-semibold">{v.proposed_start ? formatDate(v.proposed_start) : "—"}</span></p>
            <p><span className="text-muted">Men needed: </span><span className="font-semibold">{v.men_needed ?? "—"}</span></p>
            <p><span className="text-muted">Plant needed: </span><span className="font-semibold">{v.plant_needed ?? "—"}</span></p>
          </div>
          <ShareCopy url={pdf} fileName={`MSW_site_visit_${v.job_number}_${v.visit_date}.pdf`} title={`MSW site visit — ${v.job_number} ${formatDate(v.visit_date)}`} who="someone" />
        </Card>

        <section>
          <SectionTitle>Anything that might stop us · {v.blockers.filter((b) => !b.cleared_at).length} open</SectionTitle>
          <Card className="divide-y divide-line">
            {v.blockers.length === 0 && <p className="px-4 py-4 text-[14px] text-muted">No blockers recorded.</p>}
            {v.blockers.map((b, i) => (
              <div key={i} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", b.cleared_at && "opacity-70")}>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-semibold", b.cleared_at && "line-through")}>{b.text}</p>
                  <p className="text-[13px] text-muted">{labelOf(BLOCKER_SEVERITY, b.severity)} · {labelOf(BLOCKER_OWNERS, b.owner)} to sort{b.cleared_at ? ` · cleared ${formatDate(b.cleared_at)}` : ""}</p>
                </div>
                <BlockerToggle visitId={v.id} index={i} cleared={Boolean(b.cleared_at)} label={b.text} />
              </div>
            ))}
          </Card>
        </section>

        {v.areas.length > 0 && (
          <section>
            <SectionTitle>What&apos;s ready — by floor / area</SectionTitle>
            <Card className="divide-y divide-line">
              {v.areas.map((a, i) => (
                <div key={i} className="flex flex-wrap items-baseline gap-x-3 px-4 py-3">
                  <span className="w-32 font-semibold">{a.name}</span>
                  <span className={cn("font-semibold", a.status === "ready" ? "text-ok" : a.status === "part" ? "text-warn" : "text-danger")}>{labelOf(AREA_STATUS, a.status)}</span>
                  {a.expected && <span className="text-[14px] text-muted">Expected {a.expected}</span>}
                  {a.note && <span className="w-full text-[14px] text-muted sm:w-auto">{a.note}</span>}
                </div>
              ))}
            </Card>
          </section>
        )}

        {CHECKLIST.map((g) => (
          <section key={g.title}>
            <SectionTitle>{g.title}</SectionTitle>
            <Card className="divide-y divide-line">
              {g.items.map((it) => {
                const c = v.checklist[it.key];
                return (
                  <div key={it.key} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[1fr_6rem_1.2fr] sm:items-baseline">
                    <span className="text-[14px]">{it.label}</span>
                    <span className={cn("font-semibold", answerTone(c?.answer))}>{c?.answer ? labelOf(ANSWERS, c.answer) : "—"}</span>
                    <span className="text-[14px] text-muted">{c?.note}</span>
                  </div>
                );
              })}
            </Card>
          </section>
        ))}

        {v.actions.length > 0 && (
          <section>
            <SectionTitle>Actions</SectionTitle>
            <Card className="divide-y divide-line">
              {v.actions.map((a, i) => <p key={i} className="px-4 py-2.5 text-[14px]"><span className="font-semibold">{a.what}</span>{a.who && ` — ${a.who}`}{a.by && ` · by ${a.by}`}</p>)}
            </Card>
          </section>
        )}
        {v.notes && <section><SectionTitle>Notes</SectionTitle><Card className="whitespace-pre-line p-4 text-[14px]">{v.notes}</Card></section>}

        {v.photos.length > 0 && (
          <section>
            <SectionTitle>Photos · {v.photos.length}</SectionTitle>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {v.photos.map((p) => (
                <li key={p.id}>
                  <a href={`/api/files/visit-photos/${p.id}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/visit-photos/${p.id}`} alt={p.caption ?? "Site visit photo"} className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-line" loading="lazy" />
                  </a>
                  {p.caption && <p className="mt-1 text-[13px] text-muted">{p.caption}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="justify-self-start"><DeleteVisitButton visitId={v.id} /></div>
      </div>
    </div>
  );
}
