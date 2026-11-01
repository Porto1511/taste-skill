"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import { useUpload } from "./upload";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

/** New document (with first revision) or, when documentId is given, a new revision. */
export function DocumentUploadForm({ jobId, areas, documentId, suggestedRevision, defaultKind = "drawing" }: {
  jobId: string; areas: { id: string; name: string }[]; documentId?: string; suggestedRevision?: string; defaultKind?: "drawing" | "rams";
}) {
  const router = useRouter();
  const { progress, send } = useUpload();
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setErrs({}); setDone(null);
    const fd = new FormData(e.currentTarget);
    fd.set("approve", fd.get("approve") ? "1" : "0");
    if (!documentId) fd.set("jobId", jobId);
    const res = await send(documentId ? `/api/documents/${documentId}/revisions` : "/api/documents", fd);
    if (!res.ok) { setError(res.error); setErrs(res.fieldErrors ?? {}); return; }
    formRef.current?.reset();
    setDone(fd.get("approve") === "1" ? "Uploaded and approved for use — site users have been notified." : "Uploaded as a draft. It is not visible on site until approved.");
    if (!documentId && typeof res.body.href === "string") router.push(res.body.href);
    else router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4" noValidate>
      {!documentId && (
        <>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <Field label="Type" htmlFor="kind"><Select id="kind" name="kind" defaultValue={defaultKind}><option value="drawing">Drawing</option><option value="rams">RAMS</option></Select></Field>
            <Field label="Document number" htmlFor="docNumber" error={errs.docNumber}><Input id="docNumber" name="docNumber" className="font-mono" placeholder="MSW-2611-DK-105" required /></Field>
          </div>
          <Field label="Title" htmlFor="title" error={errs.title}><Input id="title" name="title" placeholder="Level 5 Metal Deck Layout" required /></Field>
          <Field label="Description" htmlFor="description" optional><Textarea id="description" name="description" rows={2} className="min-h-0" /></Field>
          {areas.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">Applies to</legend>
              <p className="mb-2 text-[13px] text-muted">Leave all unticked for the whole job. Only people allocated to a ticked area will see it.</p>
              <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                {areas.map((a) => <Checkbox key={a.id} name="areaIds" value={a.id} label={a.name} />)}
              </div>
            </fieldset>
          )}
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Field label="Revision" htmlFor="revision" error={errs.revision}><Input id="revision" name="revision" className="font-mono uppercase" defaultValue={suggestedRevision} placeholder="C01" required /></Field>
        <Field label="What changed" htmlFor="changeNote" optional><Input id="changeNote" name="changeNote" placeholder="e.g. Riser opening at C3 enlarged" /></Field>
      </div>
      <Field label="PDF file" htmlFor="file" error={errs.file} hint="PDF only, up to 50 MB.">
        <input id="file" name="file" type="file" accept="application/pdf,.pdf" required
          className="block w-full rounded-xl border border-dashed border-line-strong bg-paper p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:font-semibold file:text-white" />
      </Field>
      <Checkbox name="approve" value="1" label="Approve for use now" description="Publishes it to site as the current revision, supersedes the previous one and notifies allocated people. Leave unticked to upload as a draft." />
      {error && <Alert>{error}</Alert>}
      {done && <Alert tone="ok">{done}</Alert>}
      <button type="submit" disabled={progress !== null} className={buttonClass("dark", "lg", "relative justify-self-start overflow-hidden")}>
        {progress !== null && <span className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${progress * 100}%` }} />}
        <UploadSimple className="relative size-5" weight="bold" />
        <span className="relative">{progress !== null ? `Uploading ${Math.round(progress * 100)}%` : documentId ? "Upload revision" : "Add document"}</span>
      </button>
    </form>
  );
}
