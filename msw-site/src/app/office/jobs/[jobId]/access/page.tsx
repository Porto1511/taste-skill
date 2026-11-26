import { requireStaff } from "@/server/auth/viewer";
import { getJobAccess, getJobCompanies } from "@/server/queries/office";
import { JobCompanies } from "@/components/office/job-companies";
import { AccessManager, RevokedHistory } from "@/components/office/access-manager";

export default async function JobAccessPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  const [data, companies] = await Promise.all([getJobAccess(viewer, jobId), getJobCompanies(viewer, jobId)]);
  return (
    <div>
      <JobCompanies jobId={jobId} holding={companies.holding} others={companies.others} canEdit={viewer.isAdmin} />
      <AccessManager jobId={jobId} areas={data.areas} assignments={data.assignments} companies={data.companies} canEdit={viewer.isAdmin} />
      <RevokedHistory items={data.revoked} />
    </div>
  );
}
