import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { listDayworks } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DayworkTable } from "@/components/office/daywork-table";

export const metadata: Metadata = { title: "Daywork sheets" };

export default async function OfficeDayworkPage() {
  const viewer = await requireStaff();
  return (
    <div>
      <PageHeader title="Daywork sheets" description="Standing time and extra work signed off by the client on site. Hours and materials only — rates stay with commercial." />
      <Card className="overflow-hidden"><DayworkTable items={await listDayworks(viewer)} /></Card>
    </div>
  );
}
