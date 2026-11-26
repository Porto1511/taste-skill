import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getVariation } from "@/server/queries/variations";
import { PageHeader } from "@/components/layout/page-header";
import { VariationView } from "@/components/handover/variation-view";

export default async function OfficeVariationDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await getVariation(viewer, id);
  if (!v) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/office/variations", label: "Variations" }} title={<span className="sr-only">Variation</span>} />
      <VariationView v={v} />
    </div>
  );
}
