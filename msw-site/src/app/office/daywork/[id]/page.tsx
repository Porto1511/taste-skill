import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getDaywork } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { DayworkView } from "@/components/handover/daywork-view";

export default async function OfficeDayworkDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getDaywork(viewer, id);
  if (!d) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/office/daywork", label: "Daywork sheets" }} title={<span className="sr-only">Daywork sheet</span>} />
      <DayworkView d={d} />
    </div>
  );
}
