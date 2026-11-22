import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { listCertificateLibrary } from "@/server/queries/certificates";
import { PageHeader } from "@/components/layout/page-header";
import { CertificateLibrary } from "@/components/certificates/certificate-library";

export const metadata: Metadata = { title: "Certificates" };

export default async function OfficeCertificatesPage() {
  const viewer = await requireStaff();
  const companies = await listCertificateLibrary(viewer);
  return (
    <div>
      <PageHeader title="Certificates" description="Net certificates and other certs for MSW and each subcontractor — print them or send them when a client asks. Subcontractors can upload their own." />
      <CertificateLibrary companies={companies} />
    </div>
  );
}
