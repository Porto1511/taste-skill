import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getSiteDocument } from "@/server/queries/site";
import { PdfViewer } from "@/components/pdf/pdf-viewer";
import { ViewerBar } from "@/components/pdf/viewer-bar";
import { formatDate, formatBytes } from "@/lib/format";

type Props = { params: Promise<{ jobId: string; documentId: string }> };
export const metadata: Metadata = { title: "Document" };

export default async function SiteDocumentPage({ params }: Props) {
  const viewer = await requireViewer();
  const { jobId, documentId } = await params;
  if (![jobId, documentId].every((v) => /^[0-9a-f-]{36}$/i.test(v))) notFound();
  const data = await getSiteDocument(viewer, jobId, documentId);
  if (!data) notFound();
  const { document: doc, current, areas, job } = data;

  if (!current) {
    return (
      <div className="grid flex-1 place-items-center bg-paper p-6 text-center">
        <div className="max-w-sm">
          <p className="font-mono text-sm text-muted">{doc.doc_number}</p>
          <h1 className="mt-1 text-xl font-semibold">No approved revision is currently issued</h1>
          <p className="mt-2 text-muted">This document has been withdrawn or is awaiting approval. Do not work from any previous copy — check with the MSW office.</p>
          <Link href={`/jobs/${jobId}`} className="mt-5 inline-flex h-12 items-center rounded-xl bg-ink px-5 font-semibold text-white">Back to job</Link>
        </div>
      </div>
    );
  }

  const file = `/api/files/revisions/${current.id}`;
  return (
    <>
      <ViewerBar
        backHref={`/jobs/${jobId}`}
        backLabel={`Back to ${job.name}`}
        docNumber={doc.doc_number}
        revision={current.revision}
        title={doc.title}
        downloadHref={`${file}?download=1`}
        details={
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle">Status</dt><dd className="font-semibold text-ok">Approved for use — current revision</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle">Approved</dt><dd>{formatDate(current.approved_at)}</dd></div>
            {current.change_note && <div><dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle">What changed</dt><dd>{current.change_note}</dd></div>}
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle">Applies to</dt><dd>{areas.length ? areas.map((a) => a.name).join(", ") : "Whole job"}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle">File</dt><dd>{formatBytes(current.file_size)}</dd></div>
            {doc.kind === "rams" && (
              <p className="rounded-lg bg-warn-soft p-2.5 text-[13px] text-[#6b3300]">Reference copy only. Site briefing and hard-copy signatures are still required.</p>
            )}
          </dl>
        }
      />
      <PdfViewer src={file} downloadHref={`${file}?download=1`} label={`${doc.doc_number} revision ${current.revision}`} />
    </>
  );
}
