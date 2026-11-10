import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getRevisionView } from "@/server/queries/site";
import { PdfViewer } from "@/components/pdf/pdf-viewer";
import { ViewerBar } from "@/components/pdf/viewer-bar";
import { formatDate, labels } from "@/lib/format";

type Props = { params: Promise<{ revisionId: string }> };
export const metadata: Metadata = { title: "Revision" };

export default async function RevisionViewerPage({ params }: Props) {
  const viewer = await requireViewer();
  const { revisionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(revisionId)) notFound();
  const rev = await getRevisionView(viewer, revisionId);
  if (!rev) notFound();
  const file = `/api/files/revisions/${rev.id}`;
  const back = viewer.isStaff ? `/office/jobs/${rev.job_id}/documents/${rev.document_id}` : `/jobs/${rev.job_id}`;
  const tone = rev.status === "approved" ? "ok" : rev.status === "draft" ? "info" : "danger";
  return (
    <>
      <ViewerBar
        backHref={back}
        backLabel="Back"
        docNumber={rev.doc_number}
        revision={rev.revision}
        title={rev.title}
        downloadHref={`${file}?download=1`}
        tone={tone}
        details={
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-[12px] font-bold uppercase tracking-[0.08em] text-subtle">Status</dt><dd className="font-semibold">{labels.revisionStatus[rev.status]}</dd></div>
            <div><dt className="text-[12px] font-bold uppercase tracking-[0.08em] text-subtle">Uploaded</dt><dd>{formatDate(rev.uploaded_at)}</dd></div>
            {rev.change_note && <div><dt className="text-[12px] font-bold uppercase tracking-[0.08em] text-subtle">Change note</dt><dd>{rev.change_note}</dd></div>}
            <div><dt className="text-[12px] font-bold uppercase tracking-[0.08em] text-subtle">Job</dt><dd>{rev.job_number} · {rev.job_name}</dd></div>
          </dl>
        }
      />
      {rev.status !== "approved" && (
        <div className={`px-4 py-2 text-center text-[13px] font-semibold ${rev.status === "draft" ? "bg-info text-white" : "bg-danger text-white"}`}>
          {rev.status === "draft" && "DRAFT — not issued to site. Office view only."}
          {rev.status === "superseded" && `SUPERSEDED — office reference only. ${rev.current_revision_id ? "A newer revision is current." : ""}`}
          {rev.status === "withdrawn" && "WITHDRAWN — must not be used."}
        </div>
      )}
      <PdfViewer src={file} downloadHref={`${file}?download=1`} label={`${rev.doc_number} revision ${rev.revision}`} />
    </>
  );
}
