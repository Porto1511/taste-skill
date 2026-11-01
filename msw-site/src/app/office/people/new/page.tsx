import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/viewer";
import { listCompanies } from "@/server/queries/office";
import { config } from "@/server/config";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { InvitePersonForm } from "@/components/office/people-forms";

export const metadata: Metadata = { title: "Add person" };

export default async function NewPersonPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const viewer = await requireAdmin();
  const { company } = await searchParams;
  const companies = (await listCompanies(viewer)).filter((c) => c.active);
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/office/people", label: "People" }} title="Add a person" description="Create an individual login for an MSW employee or a subcontractor operative." />
      <Card className="p-5"><InvitePersonForm companies={companies} defaultCompanyId={company} demo={config.isDemo} /></Card>
    </div>
  );
}
