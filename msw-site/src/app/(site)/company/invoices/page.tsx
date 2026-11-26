import type { Metadata } from "next";
import { requireBoss } from "@/server/auth/viewer";
import { getCompanyOverview } from "@/server/queries/company";
import { listInvoices } from "@/server/queries/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { InvoiceUpload } from "@/components/company/invoice-upload";
import { InvoiceStatus, money } from "@/components/office/invoice-status";
import { formatDate } from "@/lib/format";
import { londonToday } from "@/lib/week";

export const metadata: Metadata = { title: "Invoices" };

/** The manager's invoices to MSW. Only they and the MSW office can see this page's contents. */
export default async function CompanyInvoicesPage() {
  const viewer = await requireBoss();
  const [{ jobs }, invoices] = await Promise.all([getCompanyOverview(viewer), listInvoices(viewer)]);
  return (
    <div className="grid gap-6">
      <PageHeader back={{ href: "/company", label: viewer.companyName }} title="Invoices"
        description="Send MSW your invoice for a job. The QS checks it against the sign-offs, daywork and variations." />
      {jobs.length ? <InvoiceUpload jobs={jobs} today={londonToday()} /> : <EmptyState title="No jobs yet">You can send an invoice once MSW have given you a job.</EmptyState>}
      <section>
        <SectionTitle>Sent</SectionTitle>
        {invoices.length ? (
          <Card className="divide-y divide-line overflow-hidden">
            {invoices.map((i) => (
              <a key={i.id} href={`/api/files/invoices/${i.id}`} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:bg-paper">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Invoice {i.invoice_number}</span>
                  <span className="tabular font-bold">{money(i.amount)}</span>
                </div>
                <p className="text-[13px] text-muted"><span className="font-mono">{i.job_number}</span> {i.job_name} · {formatDate(i.invoice_date)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2"><InvoiceStatus status={i.status} />{i.office_note && <span className="text-[13px]">MSW: {i.office_note}</span>}</div>
              </a>
            ))}
          </Card>
        ) : <p className="text-[14px] text-muted">None sent yet.</p>}
      </section>
    </div>
  );
}
