"use client";

import { useActionState } from "react";
import { checkInvoiceAction } from "@/server/actions/invoices";
import { idle } from "@/lib/action-state";
import { Field, Textarea } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";

export function InvoiceCheck({ id, note }: { id: string; note: string | null }) {
  const [state, action] = useActionState(checkInvoiceAction, idle);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="invoiceId" value={id} />
      <Field label="Note to their boss" htmlFor="note" optional hint="Needed for a query, e.g. which daywork sheet doesn't match.">
        <Textarea id="note" name="note" rows={3} defaultValue={note ?? ""} maxLength={2000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="status" value="checked" variant="success" size="md">Mark checked</SubmitButton>
        <SubmitButton name="status" value="query" variant="danger" size="md">Raise a query</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
