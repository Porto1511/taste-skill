import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/viewer";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CompanyForm } from "@/components/office/people-forms";

export const metadata: Metadata = { title: "Add company" };

export default async function NewCompanyPage() {
  await requireAdmin();
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/office/people", label: "People" }} title="Add a subcontracting company" description="Operational contact details only." />
      <Card className="p-5"><CompanyForm /></Card>
    </div>
  );
}
