"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Images, Plus, Trash, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { compressImage } from "@/lib/compress-image";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import {
  ANSWERS, AREA_STATUS, BLOCKER_OWNERS, BLOCKER_SEVERITY, CHECKLIST, READY_OUTCOMES, VISIT_TYPES,
  type Answer, type VisitAction, type VisitArea, type VisitBlocker,
} from "@/lib/site-visit";

export interface KnownJob { id: string; job_number: string; name: string; address: string; areas: string[] }
type Photo = { key: string; file: Blob; url: string; caption: string };

function Chips<T extends string>({ options, value, onChange, label, size = "md" }: {
  options: readonly { id: T; label: string }[]; value: T | null; onChange: (v: T | null) => void; label: string; size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(value === o.id ? null : o.id)}
          className={cn("rounded-full border font-semibold transition-colors", size === "sm" ? "min-h-10 px-3.5 text-[13px]" : "min-h-11 px-4 text-[14px]",
            value === o.id ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:border-ink/40")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Card({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="grid gap-4 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5">
      <div><h2 className="text-[16px] font-semibold">{title}</h2>{hint && <p className="text-[13px] text-muted">{hint}</p>}</div>
      {children}
    </section>
  );
}

export function SiteVisitForm({ knownJobs, today, defaultJobId }: { knownJobs: KnownJob[]; today: string; defaultJobId?: string }) {
  const router = useRouter();
  const start = knownJobs.find((j) => j.id === defaultJobId);
  const [job, setJob] = useState({ id: start?.id ?? null as string | null, number: start?.job_number ?? "", name: start?.name ?? "", address: start?.address ?? "" });
  const [visitDate, setVisitDate] = useState(today);
  const [visitType, setVisitType] = useState<string | null>("pre_start");
  const [met, setMet] = useState({ name: "", phone: "" });
  const [areas, setAreas] = useState<VisitArea[]>((start?.areas ?? []).map((name) => ({ name, status: "not_ready", note: "", expected: "" })));
  const [checklist, setChecklist] = useState<Record<string, { answer: Answer | null; note: string }>>({});
  const [blockers, setBlockers] = useState<Omit<VisitBlocker, "cleared_at">[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [ready, setReady] = useState<string | null>(null);
  const [outcome, setOutcome] = useState({ conditions: "", proposedStart: "", men: "", plant: "" });
  const [actions, setActions] = useState<VisitAction[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const onJobNumber = (number: string) => {
    const known = knownJobs.find((k) => k.job_number.toLowerCase() === number.trim().toLowerCase());
    if (!known) return setJob((j) => ({ ...j, number, id: null }));
    setJob({ id: known.id, number: known.job_number, name: known.name, address: known.address });
    if (!areas.length) setAreas(known.areas.map((name) => ({ name, status: "not_ready", note: "", expected: "" })));
  };
  const setItem = (key: string, patch: Partial<{ answer: Answer | null; note: string }>) =>
    setChecklist((c) => ({ ...c, [key]: { answer: c[key]?.answer ?? null, note: c[key]?.note ?? "", ...patch } }));
  // Photos are shrunk on the phone (≈300–500 KB each) before they are sent.
  const addPhotos = async (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).slice(0, 30 - photos.length);
    const added = await Promise.all(files.map(async (f, i) => {
      const file = await compressImage(f);
      return { key: `${Date.now()}-${i}`, file, url: URL.createObjectURL(file), caption: "" };
    }));
    setPhotos((p) => [...p, ...added]);
  };

  async function save() {
    setError(null);
    if (!job.number.trim()) return setError("Enter the job number.");
    if (job.address.trim().length < 3) return setError("Enter the site address.");
    if (!visitType) return setError("What kind of visit was it?");
    if (!ready) return setError("Ready to start? Choose one in Outcome.");
    const visit = {
      jobId: job.id, jobNumber: job.number, jobName: job.name, siteAddress: job.address, visitDate, visitType,
      metName: met.name, metPhone: met.phone,
      areas: areas.filter((a) => a.name.trim()),
      checklist, blockers: blockers.filter((b) => b.text.trim().length >= 2),
      ready, conditions: ready === "conditional" ? outcome.conditions : "", proposedStart: outcome.proposedStart,
      menNeeded: outcome.men, plantNeeded: outcome.plant, actions: actions.filter((a) => a.what.trim().length >= 2), notes,
    };
    // 1. Save the visit itself (small), 2. then send the photos one at a time.
    const fd = new FormData();
    fd.set("visit", JSON.stringify(visit));
    setBusy(true);
    setProgress("Saving…");
    const res = await fetch("/api/site-visits", { method: "POST", body: fd }).catch(() => null);
    if (!res) { setBusy(false); setProgress(null); return setError("No connection — nothing saved yet. Try again when you've got signal."); }
    const body = await res.json().catch(() => ({}));
    if (res.status !== 201 || !body.href) {
      setBusy(false); setProgress(null);
      return setError(body.error ?? `The site visit could not be saved (error ${res.status}). Try again.`);
    }
    let failed = 0;
    for (const [i, p] of photos.entries()) {
      setProgress(`Uploading photo ${i + 1} of ${photos.length}…`);
      const pf = new FormData();
      pf.set("photo", p.file, `photo-${i + 1}.jpg`);
      pf.set("caption", p.caption);
      const r = await fetch(`/api/site-visits/${body.id}/photos`, { method: "POST", body: pf }).catch(() => null);
      if (!r || r.status !== 201) failed++;
    }
    router.push(failed ? `${body.href}?photosFailed=${failed}` : body.href);
  }

  return (
    <div className="grid gap-4">
      <Card title="Job & visit">
        <Field label="Job number" htmlFor="jobNumber" hint={job.id ? "Matched to a job we already have." : "A new job that isn't set up yet is fine."}>
          <Input id="jobNumber" value={job.number} onChange={(e) => onJobNumber(e.target.value)} list="visit-jobs" autoComplete="off" className="font-mono uppercase" maxLength={40} />
          <datalist id="visit-jobs">{knownJobs.map((k) => <option key={k.id} value={k.job_number}>{k.name}</option>)}</datalist>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site / job name" htmlFor="jobName" optional><Input id="jobName" value={job.name} onChange={(e) => setJob({ ...job, name: e.target.value })} maxLength={160} /></Field>
          <Field label="Date of visit" htmlFor="visitDate"><Input id="visitDate" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} /></Field>
        </div>
        <Field label="Site address" htmlFor="siteAddress"><Textarea id="siteAddress" rows={2} className="min-h-0" value={job.address} onChange={(e) => setJob({ ...job, address: e.target.value })} maxLength={300} /></Field>
        <div className="grid gap-1.5"><p className="text-sm font-semibold">Type of visit</p><Chips label="Type of visit" options={VISIT_TYPES} value={visitType} onChange={setVisitType} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Who you met (site manager)" htmlFor="metName" optional><Input id="metName" value={met.name} onChange={(e) => setMet({ ...met, name: e.target.value })} maxLength={120} /></Field>
          <Field label="Their phone" htmlFor="metPhone" optional><Input id="metPhone" type="tel" value={met.phone} onChange={(e) => setMet({ ...met, phone: e.target.value })} maxLength={40} /></Field>
        </div>
      </Card>

      <Card title="What's ready — by floor / area">
        {areas.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-2xl bg-paper p-3">
            <div className="flex items-center gap-2">
              <Input aria-label={`Area ${i + 1}`} value={a.name} onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="e.g. Level 3" maxLength={80} />
              <button type="button" onClick={() => setAreas(areas.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center text-danger" aria-label={`Remove area ${i + 1}`}><Trash className="size-5" /></button>
            </div>
            <Chips size="sm" label={`${a.name || "Area"} status`} options={AREA_STATUS} value={a.status} onChange={(v) => setAreas(areas.map((x, j) => (j === i ? { ...x, status: v ?? "not_ready" } : x)))} />
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <Input aria-label={`${a.name || "Area"} expected`} value={a.expected} onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, expected: e.target.value } : x)))} placeholder="Expected (e.g. w/c 8 Dec)" maxLength={60} />
              <Input aria-label={`${a.name || "Area"} note`} value={a.note} onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} placeholder="Note (e.g. steel up, not bolted off)" maxLength={500} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setAreas([...areas, { name: "", status: "not_ready", note: "", expected: "" }])} className={buttonClass("secondary", "md", "justify-self-start")}><Plus className="size-5" weight="bold" /> Add floor / area</button>
      </Card>

      {CHECKLIST.map((g) => (
        <Card key={g.title} title={g.title}>
          {g.items.map((it) => (
            <div key={it.key} className="grid gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
              <div><p className="text-[15px] font-semibold">{it.label}</p>{it.hint && <p className="text-[13px] text-muted">{it.hint}</p>}</div>
              <Chips size="sm" label={it.label} options={ANSWERS} value={checklist[it.key]?.answer ?? null} onChange={(v) => setItem(it.key, { answer: v })} />
              <Input aria-label={`${it.label} note`} value={checklist[it.key]?.note ?? ""} onChange={(e) => setItem(it.key, { note: e.target.value })} placeholder="Note" maxLength={500} />
            </div>
          ))}
        </Card>
      ))}

      <Card title="Anything that might stop us" hint="Who needs to sort it, and how serious it is.">
        {blockers.map((b, i) => (
          <div key={i} className="grid gap-2 rounded-2xl bg-paper p-3">
            <div className="flex items-start gap-2">
              <Textarea aria-label={`Blocker ${i + 1}`} rows={2} className="min-h-0" value={b.text} onChange={(e) => setBlockers(blockers.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="e.g. No handrails on Level 4 east side" maxLength={500} />
              <button type="button" onClick={() => setBlockers(blockers.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center text-danger" aria-label={`Remove blocker ${i + 1}`}><Trash className="size-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select aria-label={`Blocker ${i + 1} severity`} value={b.severity} onChange={(e) => setBlockers(blockers.map((x, j) => (j === i ? { ...x, severity: e.target.value as VisitBlocker["severity"] } : x)))}>
                {BLOCKER_SEVERITY.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
              <Select aria-label={`Blocker ${i + 1} who sorts it`} value={b.owner} onChange={(e) => setBlockers(blockers.map((x, j) => (j === i ? { ...x, owner: e.target.value as VisitBlocker["owner"] } : x)))}>
                {BLOCKER_OWNERS.map((o) => <option key={o.id} value={o.id}>{o.label} to sort</option>)}
              </Select>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setBlockers([...blockers, { text: "", owner: "client", severity: "stops" }])} className={buttonClass("secondary", "md", "justify-self-start")}><Plus className="size-5" weight="bold" /> Add blocker</button>
      </Card>

      <Card title="Photos" hint="Up to 30. Add a caption so you know what you're looking at later.">
        {photos.length > 0 && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.key} className="grid gap-1.5">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
                  <button type="button" onClick={() => setPhotos(photos.filter((x) => x.key !== p.key))} className="absolute right-1 top-1 grid size-9 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove photo"><X className="size-4" /></button>
                </div>
                <Input aria-label="Photo caption" value={p.caption} onChange={(e) => setPhotos(photos.map((x) => (x.key === p.key ? { ...x, caption: e.target.value } : x)))} placeholder="Caption" maxLength={300} className="py-2 text-[14px]" />
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => camera.current?.click()} className={buttonClass("dark", "lg")}><Camera className="size-5" /> Take photo</button>
          <button type="button" onClick={() => gallery.current?.click()} className={buttonClass("secondary", "lg")}><Images className="size-5" /> From phone</button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
        <input ref={gallery} type="file" accept="image/*" multiple hidden aria-label="Choose photos" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
      </Card>

      <Card title="Outcome">
        <Chips label="Ready to start?" options={READY_OUTCOMES} value={ready} onChange={setReady} />
        {ready === "conditional" && <Field label="Ready if…" htmlFor="conditions"><Textarea id="conditions" rows={2} className="min-h-0" value={outcome.conditions} onChange={(e) => setOutcome({ ...outcome, conditions: e.target.value })} maxLength={2000} placeholder="e.g. handrails on Level 4 and MEWP on site" /></Field>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Proposed start" htmlFor="proposedStart" optional><Input id="proposedStart" type="date" value={outcome.proposedStart} onChange={(e) => setOutcome({ ...outcome, proposedStart: e.target.value })} /></Field>
          <Field label="Men needed" htmlFor="men" optional><Input id="men" value={outcome.men} onChange={(e) => setOutcome({ ...outcome, men: e.target.value })} placeholder="e.g. 4 net & deck" maxLength={200} /></Field>
          <Field label="Plant needed" htmlFor="plant" optional><Input id="plant" value={outcome.plant} onChange={(e) => setOutcome({ ...outcome, plant: e.target.value })} placeholder="e.g. 2 × scissor lift" maxLength={500} /></Field>
        </div>
      </Card>

      <Card title="Actions" hint="What needs doing, who, and by when.">
        {actions.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-2xl bg-paper p-3 sm:grid-cols-[1fr_9rem_9rem_auto]">
            <Input aria-label={`Action ${i + 1}`} value={a.what} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, what: e.target.value } : x)))} placeholder="e.g. Book MEWP" maxLength={300} />
            <Input aria-label={`Action ${i + 1} who`} value={a.who} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, who: e.target.value } : x)))} placeholder="Who" maxLength={80} />
            <Input aria-label={`Action ${i + 1} by when`} value={a.by} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, by: e.target.value } : x)))} placeholder="By when" maxLength={40} />
            <button type="button" onClick={() => setActions(actions.filter((_, j) => j !== i))} className="grid size-11 place-items-center text-danger" aria-label={`Remove action ${i + 1}`}><Trash className="size-5" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setActions([...actions, { what: "", who: "", by: "" }])} className={buttonClass("secondary", "md", "justify-self-start")}><Plus className="size-5" weight="bold" /> Add action</button>
      </Card>

      <Card title="Notes"><Textarea aria-label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} /></Card>

      {error && <Alert>{error}</Alert>}
      <button type="button" onClick={save} disabled={busy} className={buttonClass("primary", "xl", "w-full")}>{busy ? progress ?? "Saving…" : "Save site visit"}</button>
    </div>
  );
}
