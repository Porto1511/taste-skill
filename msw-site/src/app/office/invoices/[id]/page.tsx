import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getInvoice } from "@/server/queries/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { InvoiceCheck } from "@/components/office/invoice-check";
import { InvoiceStatus, money } from "@/components/office/invoice-status";
import { formatDate, formatDateTime } from "@/lib/format";

export default async function OfficeInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const i = await getInvoice(viewer, id);
  if (!i) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/office/invoices", label: "Invoices" }} eyebrow={i.company_name} title={`Invoice ${i.invoice_number}`}
        description={<><Link href={`/office/jobs/${i.job_id}`} className="underline">{i.job_number} {i.job_name}</Link> · {formatDate(i.invoice_date)}</>}
        actions={<ButtonLink href={`/office/qs?job=${i.job_id}`} variant="secondary">Check against the QS view</ButtonLink>} />
      <div className="grid gap-4">
        <Card className="grid gap-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="tabular text-[32px] font-semibold">{money(i.amount)}</span><InvoiceStatus status={i.status} /></div>
          {i.notes && <p className="text-[15px]"><span className="text-muted">Their note: </span>{i.notes}</p>}
          <p className="text-[13px] text-muted">Sent by {i.uploaded_by_name ?? "—"} · {formatDateTime(i.created_at)}{i.checked_at ? ` · last checked by ${i.checked_by_name} ${formatDateTime(i.checked_at)}` : ""}</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/api/files/invoices/${i.id}`} external variant="dark">Open the PDF</ButtonLink>
          </div>
        </Card>
        <Card className="p-5"><InvoiceCheck id={i.id} note={i.office_note} /></Card>
      </div>
    </div>
  );
}
