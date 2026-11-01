import { requireStaff } from "@/server/auth/viewer";
import { getJobAccess } from "@/server/queries/office";
import { AccessManager, RevokedHistory } from "@/components/office/access-manager";

export default async function JobAccessPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  const data = await getJobAccess(viewer, jobId);
  return (
    <div>
      <AccessManager jobId={jobId} areas={data.areas} assignments={data.assignments} companies={data.companies} canEdit={viewer.isAdmin} />
      <RevokedHistory items={data.revoked} />
    </div>
  );
}
