"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { FilePdf, PaperPlaneTilt, Printer, Trash, UploadSimple } from "@phosphor-icons/react";
import type { CertificateCompany } from "@/server/queries/certificates";
import { deleteCertificateAction } from "@/server/actions/certificates";
import { sendPdf } from "@/components/handover/share-copy";
import { idle } from "@/lib/action-state";
import { formatBytes, formatDate } from "@/lib/format";
import { Alert, Input } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** One card per company: upload certs (e.g. net certs) and print or send them when a client asks. */
export function CertificateLibrary({ companies, canEdit = true }: { companies: CertificateCompany[]; canEdit?: boolean }) {
  return (
    <div className="grid gap-5">
      {companies.map((c) => <CompanyCard key={c.id} company={c} canEdit={canEdit} />)}
    </div>
  );
}

function CompanyCard({ company, canEdit }: { company: CertificateCompany; canEdit: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function upload() {
    setError(null);
    if (title.trim().length < 2) return setError("Give it a name, e.g. Net certificates 2026.");
    if (!file) return setError("Choose the PDF to upload.");
    const fd = new FormData();
    fd.set("companyId", company.id); fd.set("title", title); fd.set("file", file);
    setBusy(true);
    const res = await fetch("/api/certificates", { method: "POST", body: fd }).catch(() => null);
    setBusy(false);
    if (!res) return setError("No connection — try again.");
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Upload failed.");
    setTitle(""); setFile(null); if (picker.current) picker.current.value = "";
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)] ring-1 ring-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
        <h2 className="text-[17px] font-semibold">{company.name}{company.is_msw && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[12px] font-semibold text-brand-2">MSW&apos;s own</span>}</h2>
        <span className="text-[13px] text-muted">{company.certificates.length} file{company.certificates.length === 1 ? "" : "s"}</span>
      </div>
      {company.certificates.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {company.certificates.map((x) => <CertRow key={x.id} cert={x} company={company.name} canEdit={canEdit} />)}
        </ul>
      ) : <p className="px-5 pt-2 text-[14px] text-muted">No certificates yet.</p>}
      {canEdit ? <div className="mt-3 grid gap-2 border-t border-line bg-paper px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <Input aria-label={`Name for the new ${company.name} certificate file`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name, e.g. Net certificates 2026" maxLength={160} />
        <label className={cn(buttonClass("secondary", "md"), "cursor-pointer")}>
          <FilePdf className="size-5" /> <span className="max-w-[14rem] truncate">{file ? file.name : "Choose PDF"}</span>
          <input ref={picker} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label={`Choose a PDF for ${company.name}`} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button type="button" onClick={upload} disabled={busy} className={buttonClass("dark", "md")}><UploadSimple className="size-5" weight="bold" /> {busy ? "Uploading…" : "Upload"}</button>
        {error && <div className="sm:col-span-3"><Alert>{error}</Alert></div>}
      </div> : <div className="h-4" />}
    </section>
  );
}

function CertRow({ cert, company, canEdit }: { cert: CertificateCompany["certificates"][number]; company: string; canEdit: boolean }) {
  const [state, del, deleting] = useActionState(deleteCertificateAction, idle);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const url = `/api/files/certificates/${cert.id}`;
  const fileName = `${company} - ${cert.title}.pdf`.replace(/[^\w.\- ]+/g, "");
  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <FilePdf className="size-6 shrink-0 text-brand" weight="fill" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{cert.title}</p>
          <p className="truncate text-[12px] text-muted">{cert.file_name} · {formatBytes(cert.file_size)} · added {formatDate(cert.created_at)}{cert.uploaded_by_name ? ` by ${cert.uploaded_by_name}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}><Printer className="size-4" /> Print</a>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={buttonClass("primary", "sm")}><PaperPlaneTilt className="size-4" weight="fill" /> Send</button>
          {canEdit && <form action={del} onSubmit={(e) => { if (!confirm(`Delete "${cert.title}"? This can't be undone.`)) e.preventDefault(); }}>
            <input type="hidden" name="certificateId" value={cert.id} />
            <button disabled={deleting} aria-label={`Delete ${cert.title}`} className={buttonClass("ghost", "sm", "min-w-11 text-danger")}><Trash className="size-4" /></button>
          </form>}
        </div>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 rounded-2xl bg-paper p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <Input type="email" aria-label="Client's email address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Client's email address (optional)" />
          <button type="button" disabled={sending} className={buttonClass("primary", "md")}
            onClick={async () => { setSending(true); try { await sendPdf(url, fileName, `${company} — ${cert.title}`, email || null); } catch { /* cancelled */ } setSending(false); }}>
            {sending ? "Preparing…" : "Send"}
          </button>
          <p className="text-[12px] text-muted sm:col-span-2">Until the MSW email is connected, this opens your phone&apos;s share options (email, WhatsApp…) or, on a computer, downloads the file and starts an email to the address above.</p>
        </div>
      )}
      {state.error && <p className="mt-1 text-[13px] text-danger" role="alert">{state.error}</p>}
    </li>
  );
}
