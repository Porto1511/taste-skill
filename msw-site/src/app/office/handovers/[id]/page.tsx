import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getHandover } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { HandoverView } from "@/components/handover/handover-view";

export default async function OfficeHandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const h = await getHandover(viewer, id);
  if (!h) notFound();
  return (
    <div className="max-w-2xl">
      <PageHeader back={{ href: `/office/jobs/${h.job_id}/handovers`, label: `${h.job_number} handovers` }} title={<span className="sr-only">Handover</span>} />
      <HandoverView h={h} />
    </div>
  );
}
