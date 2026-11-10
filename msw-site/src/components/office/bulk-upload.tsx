"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle, FilePdf, UploadSimple, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { guessArea, nextRevision, parseDrawingFileName } from "@/lib/drawing-name";
import { Alert, Checkbox, Input, Select } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { useUpload } from "./upload";

export interface ExistingDoc { id: string; docNumber: string; title: string; latest: string | null; areas: string }
type Row = {
  key: string; file: File; docNumber: string; revision: string; title: string; kind: "drawing" | "rams"; areaId: string;
  state: "ready" | "uploading" | "done" | "error"; message?: string;
};

/**
 * Drop one or many PDFs. Number, revision and title are read from each file
 * name; a number that already exists on the job becomes its next revision.
 * Only fix what is wrong, then upload.
 */
export function BulkUpload({ jobId, areas, existing }: { jobId: string; areas: { id: string; name: string }[]; existing: ExistingDoc[] }) {
  const router = useRouter();
  const { progress, send } = useUpload();
  const [rows, setRows] = useState<Row[]>([]);
  const [issue, setIssue] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const match = (n: string) => existing.find((d) => d.docNumber.toLowerCase() === n.trim().toLowerCase());

  function add(list: FileList | null) {
    if (!list) return;
    setError(null);
    const pdfs = Array.from(list).filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
    if (pdfs.length < list.length) setError("Only PDFs can be uploaded — other files were skipped.");
    setRows((all) => [...all, ...pdfs.map((file, i): Row => {
      const p = parseDrawingFileName(file.name);
      const stem = file.name.replace(/\.pdf$/i, "");
      const docNumber = p.docNumber || stem.toUpperCase().slice(0, 60);
      const ex = match(docNumber);
      return {
        key: `${Date.now()}-${i}-${file.name}`, file, docNumber, kind: p.kind, state: "ready",
        revision: p.revision || (ex ? nextRevision(ex.latest) : p.kind === "rams" ? "01" : "C01"),
        title: p.title || ex?.title || stem,
        areaId: guessArea(stem, areas),
      };
    })]);
  }
  const set = (key: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function uploadAll() {
    setError(null);
    const todo = rows.filter((r) => r.state !== "done");
    const seen = new Set<string>();
    for (const r of todo) {
      const n = r.docNumber.trim().toLowerCase();
      if (!n || !r.revision.trim()) return setError(`${r.file.name}: needs a number and a revision.`);
      if (seen.has(n)) return setError(`${r.docNumber} appears twice — upload one revision at a time.`);
      seen.add(n);
    }
    setBusy(true);
    let failed = 0;
    for (const r of todo) {
      set(r.key, { state: "uploading", message: undefined });
      const ex = match(r.docNumber);
      const fd = new FormData();
      fd.set("file", r.file);
      fd.set("revision", r.revision.trim());
      fd.set("approve", issue ? "1" : "0");
      if (!ex) {
        fd.set("jobId", jobId); fd.set("kind", r.kind); fd.set("docNumber", r.docNumber.trim());
        fd.set("title", r.title.trim().length >= 2 ? r.title.trim() : r.docNumber.trim());
        if (r.areaId) fd.set("areaIds", r.areaId);
      }
      const res = await send(ex ? `/api/documents/${ex.id}/revisions` : "/api/documents", fd);
      if (res.ok) set(r.key, { state: "done" });
      else { failed++; set(r.key, { state: "error", message: Object.values(res.fieldErrors ?? {})[0] ?? res.error }); }
    }
    setBusy(false);
    router.refresh();
    if (!failed) setTimeout(() => setRows((all) => all.filter((r) => r.state !== "done")), 2500);
  }

  const pending = rows.filter((r) => r.state !== "done").length;
  return (
    <div className="grid gap-4">
      <button type="button" onClick={() => picker.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={cn("grid place-items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors", drag ? "border-brand bg-brand-soft" : "border-line-strong bg-paper hover:bg-card")}>
        <UploadSimple className="size-8" weight="bold" />
        <span className="text-[16px] font-semibold">Drop drawings or RAMS here</span>
        <span className="text-[13px] text-muted">or click to choose — select as many PDFs as you like</span>
      </button>
      <input ref={picker} type="file" accept="application/pdf,.pdf" multiple hidden aria-label="Choose PDFs"
        onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

      {rows.length > 0 && (
        <>
          <p className="text-[13px] text-muted">Filled in from the file names — only change anything that&apos;s wrong.</p>
          <ul className="grid gap-2">
            {rows.map((r) => {
              const ex = match(r.docNumber);
              const locked = busy || r.state === "done";
              return (
                <li key={r.key} className={cn("grid gap-2 rounded-xl border bg-card p-3", r.state === "error" ? "border-danger" : r.state === "done" ? "border-ok" : "border-line")}>
                  <div className="flex items-center gap-2 text-[13px]">
                    <FilePdf className="size-4 shrink-0 text-danger" />
                    <span className="min-w-0 flex-1 truncate text-muted">{r.file.name}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold", ex ? "bg-info-soft text-info" : "bg-ink/[0.06]")}>
                      {ex ? `New revision · was ${ex.latest ?? "—"}` : "New document"}
                    </span>
                    {r.state === "done" ? <CheckCircle className="size-5 text-ok" weight="fill" aria-label="Uploaded" />
                      : r.state === "uploading" ? <span className="tabular text-[12px] font-semibold">{Math.round((progress ?? 0) * 100)}%</span>
                      : !busy && <button type="button" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} aria-label={`Remove ${r.file.name}`} className="text-muted hover:text-ink"><X className="size-4" /></button>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(9rem,12rem)_5rem_1fr]">
                    <Input aria-label="Number" value={r.docNumber} disabled={locked} onChange={(e) => set(r.key, { docNumber: e.target.value })} className="font-mono text-[14px]" />
                    <Input aria-label="Revision" value={r.revision} disabled={locked} onChange={(e) => set(r.key, { revision: e.target.value.toUpperCase() })} className="font-mono text-[14px] uppercase" />
                    {ex
                      ? <p className="self-center truncate text-[14px]">{ex.title} <span className="text-muted">· {ex.areas}</span></p>
                      : <Input aria-label="Title" value={r.title} disabled={locked} onChange={(e) => set(r.key, { title: e.target.value })} className="text-[14px]" />}
                  </div>
                  {!ex && (
                    <div className="grid grid-cols-2 gap-2">
                      <Select aria-label="Type" value={r.kind} disabled={locked} onChange={(e) => set(r.key, { kind: e.target.value as Row["kind"] })} className="text-[14px]">
                        <option value="drawing">Drawing</option><option value="rams">RAMS</option>
                      </Select>
                      <Select aria-label="Area" value={r.areaId} disabled={locked} onChange={(e) => set(r.key, { areaId: e.target.value })} className="text-[14px]">
                        <option value="">Whole job</option>
                        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </Select>
                    </div>
                  )}
                  {r.message && <p className="text-[13px] font-medium text-danger">{r.message}</p>}
                </li>
              );
            })}
          </ul>
          <Checkbox checked={issue} onChange={(e) => setIssue(e.target.checked)} label="Issue to site now"
            description="Makes these the current revision on site, keeps the old one for the office, and notifies the people on those areas. Untick to upload as drafts." />
        </>
      )}
      {error && <Alert>{error}</Alert>}
      {pending > 0 && (
        <button type="button" onClick={uploadAll} disabled={busy} className={buttonClass("dark", "lg", "justify-self-start")}>
          <UploadSimple className="size-5" weight="bold" /> {busy ? "Uploading…" : `Upload ${pending} file${pending === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}
