"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FilePdf, UploadSimple } from "@phosphor-icons/react";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

/** The boss sends an invoice for one of their jobs: PDF, number, date, amount. */
export function InvoiceUpload({ jobs, today }: { jobs: { job_id: string; job_number: string; name: string }[]; today: string }) {
  const router = useRouter();
  const [jobId, setJobId] = useState(jobs.length === 1 ? jobs[0].job_id : "");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function send() {
    setError(null);
    if (!jobId) return setError("Choose the job.");
    if (!number.trim()) return setError("Enter the invoice number.");
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount.replace(/[£,\s]/g, ""))) return setError("Enter the amount, e.g. 4250.00");
    if (!file) return setError("Choose the invoice PDF.");
    const fd = new FormData();
    fd.set("jobId", jobId); fd.set("invoiceNumber", number); fd.set("invoiceDate", date); fd.set("amount", amount); fd.set("notes", notes); fd.set("file", file);
    setBusy(true);
    const res = await fetch("/api/invoices", { method: "POST", body: fd }).catch(() => null);
    setBusy(false);
    if (!res) return setError("No connection — nothing sent. Try again.");
    if (res.status === 413) return setError("That PDF is too big. Try a smaller file.");
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "The invoice could not be sent.");
    setNumber(""); setAmount(""); setNotes(""); setFile(null); if (picker.current) picker.current.value = "";
    router.refresh();
  }

  return (
    <div className="grid gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
      <p className="font-semibold">Send an invoice</p>
      <Field label="Job" htmlFor="invJob">
        <Select id="invJob" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="" disabled>Choose the job…</option>
          {jobs.map((j) => <option key={j.job_id} value={j.job_id}>{j.job_number} — {j.name}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Invoice number" htmlFor="invNo"><Input id="invNo" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} /></Field>
        <Field label="Invoice date" htmlFor="invDate"><Input id="invDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Amount (£, before VAT)" htmlFor="invAmount"><Input id="invAmount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 4250.00" /></Field>
      <Field label="Notes" htmlFor="invNotes" optional><Textarea id="invNotes" rows={2} className="min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="e.g. Levels 1–2 nets, plus variation 3" /></Field>
      <label className={buttonClass("secondary", "md", "cursor-pointer")}>
        <FilePdf className="size-5" /> <span className="max-w-[16rem] truncate">{file ? file.name : "Choose invoice PDF"}</span>
        <input ref={picker} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Choose the invoice PDF" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <Alert>{error}</Alert>}
      <button type="button" onClick={send} disabled={busy} className={buttonClass("primary", "lg")}><UploadSimple className="size-5" weight="bold" /> {busy ? "Sending…" : "Send to MSW"}</button>
      <p className="text-[13px] text-muted">Only you and the MSW office can see invoices. Your lads can&apos;t, and no other company can.</p>
    </div>
  );
}
