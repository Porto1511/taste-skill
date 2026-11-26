import type { Metadata } from "next";
import { requireViewer } from "@/server/auth/viewer";
import { listCertificateLibrary } from "@/server/queries/certificates";
import { PageHeader } from "@/components/layout/page-header";
import { CertificateLibrary } from "@/components/certificates/certificate-library";

export const metadata: Metadata = { title: "Certificates" };

/** Your company's certificates (e.g. net certs): upload them, and print or send them when a client asks. */
export default async function SiteCertificatesPage() {
  const viewer = await requireViewer();
  const companies = (await listCertificateLibrary(viewer)).filter((c) => c.id === viewer.companyId);
  return (
    <div>
      <PageHeader back={viewer.isBoss ? { href: "/company", label: "My company" } : { href: "/account", label: "Me" }} title="Certificates" description={viewer.isStaff || viewer.isBoss || viewer.isMswEmployee ? "Your company's certificates. Upload them here, then print or send them when a client asks." : "Your company's certificates. Print or send them when a client asks."} />
      <CertificateLibrary companies={companies} canEdit={viewer.isStaff || viewer.isBoss || viewer.isMswEmployee} />
    </div>
  );
}
