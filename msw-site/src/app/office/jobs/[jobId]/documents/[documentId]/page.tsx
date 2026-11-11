import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { getOfficeDocument } from "@/server/queries/office";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge, RevisionStatusBadge } from "@/components/ui/badge";
import { DeleteDocumentButton, RevisionActions } from "@/components/office/revision-actions";
import { nextRevision } from "@/lib/drawing-name";
import { DocumentUploadForm } from "@/components/office/document-upload-form";
import { DocumentDetailsForm } from "@/components/office/document-details-form";
import { formatBytes, formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { requestNow } from "@/lib/now";

export default async function OfficeDocumentPage({ params }: { params: Promise<{ jobId: string; documentId: string }> }) {
  const viewer = await requireStaff();
  const { jobId, documentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) notFound();
  const data = await getOfficeDocument(viewer, documentId);
  if (!data || data.doc.job_id !== jobId) notFound();
  const { doc, reach, jobAreas } = data;
  const current = doc.revisions.find((r) => r.status === "approved");
  const seen = reach.filter((r) => r.viewed_at).length;
  const now = requestNow();
  return (
    <div>
      <Link href={`/office/jobs/${jobId}/documents`} className="mb-3 inline-flex text-sm font-medium text-muted hover:text-ink">‹ All documents</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-muted">{doc.doc_number} · {doc.kind === "drawing" ? "Drawing" : "RAMS"}</p>
          <h2 className="text-2xl font-semibold tracking-tight">{doc.title}</h2>
          <p className="text-sm text-muted">{doc.areas.length ? `Applies to ${doc.areas.map((a) => a.name).join(", ")}` : "Applies to the whole job"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {current ? <Badge tone="ok" dot className="text-sm">Rev {current.revision} is current on site</Badge> : <Badge tone="danger" dot className="text-sm">No revision issued to site</Badge>}
          {viewer.isAdmin && <DeleteDocumentButton documentId={doc.id} label={doc.doc_number} />}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-6">
          <section>
            <SectionTitle>Revision history</SectionTitle>
            <Card className="divide-y divide-line overflow-hidden">
              {doc.revisions.map((r) => (
                <div key={r.id} className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center ${r.status === "approved" ? "bg-ok-soft/40" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[15px] font-bold">Rev {r.revision}</span>
                      <RevisionStatusBadge status={r.status} />
                      {r.status === "approved" && <span className="text-[12px] text-muted">opened by {r.views} {r.views === 1 ? "person" : "people"}</span>}
                    </div>
                    {r.change_note && <p className="mt-0.5 text-[14px]">{r.change_note}</p>}
                    <p className="mt-0.5 text-[12px] text-muted">
                      Uploaded {formatDateTime(r.uploaded_at)}{r.uploaded_by_name ? ` by ${r.uploaded_by_name}` : ""} · {formatBytes(r.file_size)}
                      {r.approved_at && ` · Approved ${formatDate(r.approved_at)}${r.approved_by_name ? ` by ${r.approved_by_name}` : ""}`}
                      {r.superseded_at && ` · Superseded ${formatDate(r.superseded_at)}`}
                      {r.withdrawn_at && ` · Withdrawn ${formatDate(r.withdrawn_at)}`}
                    </p>
                  </div>
                  <RevisionActions revisionId={r.id} status={r.status} hasCurrent={Boolean(current)} canEdit={viewer.isAdmin} />
                </div>
              ))}
            </Card>
            <p className="mt-2 text-[13px] text-muted">Operatives only ever see the revision marked “Approved for use”. Superseded and draft revisions remain here for the office.</p>
          </section>

          {current && (
            <section>
              <SectionTitle action={<span className="text-sm font-semibold">{seen} of {reach.length} opened rev {current.revision}</span>}>Who has it</SectionTitle>
              <Card className="overflow-hidden">
                {reach.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">Nobody on site is currently allocated to this document&apos;s areas.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {reach.map((p) => (
                      <li key={p.user_id} className="flex items-center gap-3 px-4 py-2.5">
                        {p.viewed_at ? <CheckCircle className="size-5 text-ok" weight="fill" /> : <Circle className="size-5 text-subtle" />}
                        <Link href={`/office/people/${p.user_id}`} className="min-w-0 flex-1 hover:underline">
                          <span className="font-medium">{p.full_name}</span> <span className="text-[13px] text-muted">· {p.company_name}</span>
                        </Link>
                        <span className={`text-[13px] ${p.viewed_at ? "text-muted" : "font-semibold text-warn"}`}>{p.viewed_at ? `Opened ${relativeTime(p.viewed_at, now)}` : "Not opened yet"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <p className="mt-2 text-[13px] text-muted">Based on authenticated opens and downloads in MSW Site. It does not confirm the drawing was read or briefed.</p>
            </section>
          )}
        </div>
        {viewer.isAdmin ? <aside className="grid content-start gap-6">
          <section>
            <SectionTitle>Upload new revision</SectionTitle>
            <Card className="p-5"><DocumentUploadForm jobId={jobId} areas={[]} documentId={doc.id} suggestedRevision={nextRevision(doc.revisions[0]?.revision)} /></Card>
          </section>
          <section>
            <SectionTitle>Details &amp; areas</SectionTitle>
            <Card className="p-5"><DocumentDetailsForm doc={doc} jobAreas={jobAreas} /></Card>
          </section>
        </aside> : (
          <aside><Card className="p-5 text-[14px] text-muted">Only an MSW administrator can upload, issue or delete drawings.</Card></aside>
        )}
      </div>
    </div>
  );
}
