import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/viewer";
import { withUser } from "@/server/db";
import { PageHeader } from "@/components/layout/page-header";
import { JobForm } from "@/components/office/job-form";

export const metadata: Metadata = { title: "New job" };

export default async function NewJobPage() {
  const viewer = await requireAdmin();
  const staff = await withUser(viewer.id, async (tx) =>
    (await tx.query<{ id: string; full_name: string; job_title: string | null }>("select id, full_name, job_title from profiles where role in ('admin','office') and active order by full_name")).rows);
  return (
    <div className="max-w-4xl">
      <PageHeader back={{ href: "/office/jobs", label: "Jobs" }} title="New job" description="After creating the job you can add floors or phases, upload drawings and RAMS, and allocate people." />
      <JobForm staff={staff} />
    </div>
  );
}
