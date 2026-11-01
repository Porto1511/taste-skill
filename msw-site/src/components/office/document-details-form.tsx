"use client";

import { useActionState } from "react";
import { updateDocumentAction } from "@/server/actions/documents";
import { idle } from "@/lib/action-state";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";

export function DocumentDetailsForm({ doc, jobAreas }: {
  doc: { id: string; doc_number: string; title: string; description: string | null; areas: { id: string }[] };
  jobAreas: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(updateDocumentAction, idle);
  const selected = new Set(doc.areas.map((a) => a.id));
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="documentId" value={doc.id} />
      <Field label="Document number" htmlFor="docNumber"><Input id="docNumber" name="docNumber" defaultValue={doc.doc_number} className="font-mono" /></Field>
      <Field label="Title" htmlFor="dtitle"><Input id="dtitle" name="title" defaultValue={doc.title} /></Field>
      <Field label="Description" htmlFor="ddesc" optional><Textarea id="ddesc" name="description" defaultValue={doc.description ?? ""} rows={2} className="min-h-0" /></Field>
      {jobAreas.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Applies to</legend>
          <p className="mb-1 text-[13px] text-muted">None ticked = whole job. Changing this changes who can see it on site.</p>
          <div className="grid grid-cols-2 gap-x-3">
            {jobAreas.map((a) => <Checkbox key={a.id} name="areaIds" value={a.id} label={a.name} defaultChecked={selected.has(a.id)} />)}
          </div>
        </fieldset>
      )}
      <FormMessage state={state} />
      <SubmitButton size="md" variant="dark" className="justify-self-start">Save details</SubmitButton>
    </form>
  );
}
