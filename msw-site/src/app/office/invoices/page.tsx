import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/server/auth/viewer";
import { listInvoices } from "@/server/queries/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { Card, EmptyState } from "@/components/ui/card";
import { InvoiceStatus, money } from "@/components/office/invoice-status";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Subcontractor invoices" };

export default async function OfficeInvoicesPage() {
  const viewer = await requireStaff();
  const items = await listInvoices(viewer);
  return (
    <div>
      <PageHeader title="Subcontractor invoices"
        description="Sent in by each company's boss. Only the office and that company's boss can see them — never the lads, never another company." />
      {items.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {items.map((i) => (
            <Link key={i.id} href={`/office/invoices/${i.id}`} className="grid gap-1 px-5 py-3 hover:bg-paper sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4">
              <span className="min-w-0"><span className="block font-semibold">{i.company_name} · invoice {i.invoice_number}</span>
                <span className="block text-[13px] text-muted"><span className="font-mono">{i.job_number}</span> {i.job_name} · {formatDate(i.invoice_date)}</span></span>
              <InvoiceStatus status={i.status} />
              <span className="tabular text-right font-bold">{money(i.amount)}</span>
            </Link>
          ))}
        </Card>
      ) : <EmptyState title="No invoices yet">When a subcontractor&apos;s boss sends one in it shows here.</EmptyState>}
    </div>
  );
}
