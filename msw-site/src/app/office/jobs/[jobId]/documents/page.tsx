import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePdf } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { getOfficeJob, listOfficeDocuments, type OfficeDocument } from "@/server/queries/office";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BulkUpload } from "@/components/office/bulk-upload";
import { Alert } from "@/components/ui/form";
import { formatDate } from "@/lib/format";

export default async function JobDocumentsPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  const { deleted } = await searchParams;
  const [job, docs] = await Promise.all([getOfficeJob(viewer, jobId), listOfficeDocuments(viewer, jobId)]);
  if (!job) notFound();
  const areas = job.areas.map((a) => ({ id: a.id, name: a.name }));
  return (
    <div className="grid gap-6">
      {deleted && <Alert tone="ok" title="Drawing deleted">It has been removed for everyone, and the deletion is recorded in the job&apos;s activity.</Alert>}
      {viewer.isAdmin ? <section>
        <SectionTitle>Upload</SectionTitle>
        <Card className="p-5">
          <BulkUpload jobId={jobId} areas={areas} existing={docs.map((d) => ({
            id: d.id, docNumber: d.doc_number, title: d.title,
            latest: d.revisions[0]?.revision ?? null, areas: d.areas.length ? d.areas.map((a) => a.name).join(", ") : "Whole job",
          }))} />
        </Card>
      </section> : <Card className="p-4 text-[14px] text-muted">Only an MSW administrator can upload or delete drawings and RAMS.</Card>}
      <div className="grid content-start gap-6">
        {(["drawing", "rams"] as const).map((kind) => {
          const list = docs.filter((d) => d.kind === kind);
          return (
            <section key={kind}>
              <SectionTitle>{kind === "drawing" ? "Drawings" : "RAMS"} · {list.length}</SectionTitle>
              {list.length ? (
                <Card className="divide-y divide-line overflow-hidden">{list.map((d) => <DocRow key={d.id} doc={d} jobId={jobId} />)}</Card>
              ) : (
                <EmptyState icon={<FilePdf />} title={`No ${kind === "drawing" ? "drawings" : "RAMS"} yet`}>Drop the PDFs into the upload box above.</EmptyState>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DocRow({ doc, jobId }: { doc: OfficeDocument; jobId: string }) {
  const current = doc.revisions.find((r) => r.status === "approved");
  const drafts = doc.revisions.filter((r) => r.status === "draft").length;
  const superseded = doc.revisions.filter((r) => r.status === "superseded").length;
  return (
    <Link href={`/office/jobs/${jobId}/documents/${doc.id}`} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-paper sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[13px] font-semibold">{doc.doc_number}</p>
        <p className="font-medium">{doc.title}</p>
        <p className="text-[12px] text-muted">{doc.areas.length ? doc.areas.map((a) => a.name).join(" · ") : "Whole job"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        {current ? <Badge tone="ok" dot>Rev {current.revision} current · {formatDate(current.approved_at)}</Badge> : <Badge tone="danger" dot>Nothing issued to site</Badge>}
        {drafts > 0 && <Badge tone="info">{drafts} draft</Badge>}
        {superseded > 0 && <Badge>{superseded} superseded</Badge>}
      </div>
    </Link>
  );
}
