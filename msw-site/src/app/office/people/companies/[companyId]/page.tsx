import { notFound } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { listCompanies, listPeople } from "@/server/queries/office";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PeopleTable } from "@/components/office/people-table";
import { CompanyActiveToggle, CompanyForm } from "@/components/office/people-forms";
import { requestNow } from "@/lib/now";

export default async function CompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const viewer = await requireStaff();
  const { companyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) notFound();
  const company = (await listCompanies(viewer)).find((c) => c.id === companyId);
  if (!company) notFound();
  const people = await listPeople(viewer, { companyId });
  return (
    <div>
      <PageHeader back={{ href: "/office/people", label: "People" }} title={company.name} description={company.trade ?? undefined}
        actions={viewer.isAdmin && <ButtonLink href={`/office/people/new?company=${company.id}`} variant="primary"><Plus className="size-5" weight="bold" /> Add person</ButtonLink>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section>
          <SectionTitle>People · {people.length}</SectionTitle>
          <Card className="overflow-hidden"><PeopleTable people={people} now={requestNow()} showCompany={false} /></Card>
          <p className="mt-2 text-[13px] text-muted">Each person&apos;s jobs are allocated individually. Company membership never grants job access.</p>
        </section>
        {viewer.isAdmin && (
          <aside className="grid content-start gap-6">
            <section><SectionTitle>Company details</SectionTitle><Card className="p-5"><CompanyForm company={company} /></Card></section>
            {!company.is_msw && <section><Card className="p-5"><CompanyActiveToggle companyId={company.id} active={company.active} /></Card></section>}
          </aside>
        )}
      </div>
    </div>
  );
}
