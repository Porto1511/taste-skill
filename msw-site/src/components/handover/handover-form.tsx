"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, ImageSquare, X, Plus, Check, HandArrowDown } from "@phosphor-icons/react";
import { compressImage } from "@/lib/compress-image";
import { cn } from "@/lib/cn";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import { HANDOVER_TRADES, scopeSummary, tradeLong } from "@/lib/handover";


type Photo = { key: string; blob: Blob; preview: string };

export function HandoverForm({ jobId, jobName, areas, mainContractor, siteContact, declaration }: {
  jobId: string; jobName: string; areas: { id: string; name: string }[]; mainContractor: string | null;
  siteContact: { name: string | null; role: string | null }; declaration: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [areaId, setAreaId] = useState(areas.length === 1 ? areas[0].id : "");
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  type Check = { label: string; checked: boolean; section: string };
  const [scopes, setScopes] = useState<string[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [extraFor, setExtraFor] = useState<string>("");
  const [newCheck, setNewCheck] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signer, setSigner] = useState({ name: siteContact.name ?? "", position: siteContact.role?.split(",")[0] ?? "", company: (mainContractor ?? "").replace(/ \(fictional\)$/, ""), email: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pad = useRef<SignaturePadHandle>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const areaName = areas.find((a) => a.id === areaId)?.name;
  const scopeText = scopeSummary(scopes);
  const effectiveTitle = title.trim() || (scopes.length ? `${areaName ?? "Whole job"} — ${scopes.length === 3 ? "full handover" : `${scopeText.toLowerCase()} handover`}` : "");

  function setTrades(next: string[]) {
    const ordered = HANDOVER_TRADES.map((t) => t.id).filter((id) => next.includes(id));
    setScopes(ordered);
    setChecks((current) => {
      const kept = current.filter((c) => ordered.includes(c.section));
      for (const t of HANDOVER_TRADES) {
        if (ordered.includes(t.id) && !current.some((c) => c.section === t.id)) {
          kept.push(...t.checks.map((label) => ({ label, checked: false, section: t.id })));
        }
      }
      return HANDOVER_TRADES.flatMap((t) => kept.filter((c) => c.section === t.id));
    });
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).slice(0, 8 - photos.length);
    const added = await Promise.all(files.map(async (f) => {
      const blob = await compressImage(f);
      return { key: `${f.name}-${Math.random()}`, blob, preview: URL.createObjectURL(blob) };
    }));
    setPhotos((p) => [...p, ...added]);
  }

  function next() {
    setError(null);
    if (!scopes.length) return setError("Choose what you're handing over: nets, deck or studs.");
    if (effectiveTitle.length < 3) return setError("Say what's being handed over.");
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    setError(null);
    if (signer.name.trim().length < 2) return setError("Enter the name of the person signing.");
    if (signer.company.trim().length < 2) return setError("Enter their company.");
    if (!pad.current || pad.current.isEmpty()) return setError("Please sign in the box.");
    if (!confirmed) return setError("Tick the confirmation to accept the handover.");
    const sig = await pad.current.toBlob();
    if (!sig) return setError("The signature could not be captured. Please try again.");
    const fd = new FormData();
    fd.set("jobId", jobId);
    if (areaId) fd.set("areaId", areaId);
    fd.set("title", effectiveTitle);
    fd.set("scope", scope);
    fd.set("checklist", JSON.stringify(checks));
    scopes.forEach((sc) => fd.append("scopes", sc));
    fd.set("signerName", signer.name);
    fd.set("signerCompany", signer.company);
    fd.set("signerPosition", signer.position);
    fd.set("signerEmail", signer.email);
    fd.set("confirmed", "1");
    fd.set("signature", sig, "signature.png");
    photos.forEach((p, i) => { fd.append("photos", p.blob, `handover-${i + 1}.jpg`); fd.append("captions", ""); });
    setBusy(true);
    try {
      const res = await fetch("/api/handovers", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201 && body.href) {
        router.push(`${body.href}?signed=1`);
        router.refresh();
        return;
      }
      setError(body.error ?? "The handover could not be saved.");
    } catch {
      setError("No connection — nothing has been saved yet. Move to better signal and tap Sign & submit again.");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-5">
      <ol className="grid grid-cols-2 gap-2 text-[13px] font-semibold">
        {["The works", "Contractor signs"].map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 rounded-xl px-3 py-2", step === i + 1 ? "bg-ink text-white" : "bg-ink/[0.06] text-muted")}>
            <span className={cn("grid size-5 place-items-center rounded-full text-[11px]", step > i + 1 ? "bg-ok text-white" : step === i + 1 ? "bg-signal text-ink" : "bg-ink/10")}>
              {step > i + 1 ? <Check className="size-3" weight="bold" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What are you handing over?</legend>
            <div className="grid grid-cols-3 gap-2">
              {HANDOVER_TRADES.map((t) => {
                const on = scopes.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={on}
                    onClick={() => setTrades(on ? scopes.filter((x) => x !== t.id) : [...scopes, t.id])}
                    className={cn("flex h-16 flex-col items-center justify-center rounded-xl border-2 text-[16px] font-bold transition-colors",
                      on ? "border-ink bg-ink text-white" : "border-line-strong bg-card")}>
                    {on && <Check className="mb-0.5 size-4 text-signal" weight="bold" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setTrades(scopes.length === 3 ? [] : HANDOVER_TRADES.map((t) => t.id))}
              className={cn("mt-2 h-12 w-full rounded-xl border-2 text-[15px] font-bold",
                scopes.length === 3 ? "border-signal bg-signal text-ink" : "border-dashed border-ink/30 bg-card")}>
              {scopes.length === 3 ? "✓ Full handover — nets, deck & studs" : "Full handover (all three)"}
            </button>
          </fieldset>

          <Field label="Area" htmlFor="area">
            <Select id="area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Whole job ({jobName})</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="What's being handed over" htmlFor="title" hint={!title && effectiveTitle ? "Leave blank to use the suggested title" : undefined}>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={effectiveTitle || "e.g. Level 2 deck handover"} maxLength={160} />
          </Field>
          <Field label="Details" htmlFor="scope" optional>
            <Textarea id="scope" value={scope} onChange={(e) => setScope(e.target.value)} rows={3} maxLength={4000} placeholder="Bays, gridlines, anything outstanding or agreed" />
          </Field>

          {HANDOVER_TRADES.filter((t) => scopes.includes(t.id)).map((t) => (
            <fieldset key={t.id}>
              <legend className="mb-2 text-sm font-semibold">{t.long} checklist</legend>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                {checks.map((c, i) => c.section !== t.id ? null : (
                  <li key={c.label + i} className="flex items-center">
                    <button type="button" aria-pressed={c.checked} onClick={() => setChecks((all) => all.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                      className="flex min-h-14 flex-1 items-center gap-3 px-4 py-2 text-left text-[15px]">
                      <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border-2", c.checked ? "border-ok bg-ok text-white" : "border-line-strong")}>
                        {c.checked && <Check className="size-4" weight="bold" />}
                      </span>
                      {c.label}
                    </button>
                    <button type="button" onClick={() => setChecks((all) => all.filter((_, j) => j !== i))} className="grid size-12 place-items-center text-subtle" aria-label={`Remove “${c.label}”`}>
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {extraFor === t.id ? (
                <div className="mt-2 flex gap-2">
                  <Input autoFocus value={newCheck} onChange={(e) => setNewCheck(e.target.value)} placeholder={`Add a ${t.label.toLowerCase()} item`} maxLength={200} />
                  <button type="button" disabled={!newCheck.trim()} onClick={() => { setChecks((c) => [...c, { label: newCheck.trim(), checked: true, section: t.id }]); setNewCheck(""); setExtraFor(""); }}
                    className="grid w-14 shrink-0 place-items-center rounded-xl bg-ink text-white disabled:opacity-40" aria-label="Add item"><Plus className="size-5" weight="bold" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => { setExtraFor(t.id); setNewCheck(""); }} className="mt-1.5 inline-flex items-center gap-1 px-1 py-1.5 text-[13px] font-semibold text-signal-ink">
                  <Plus className="size-4" /> Add item
                </button>
              )}
            </fieldset>
          ))}

          <div>
            <p className="mb-2 text-sm font-semibold">Photos of the finished area <span className="font-normal text-subtle">{photos.length}/8</span></p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => camera.current?.click()} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white"><Camera className="size-6" weight="fill" /> Take photo</button>
              <button type="button" onClick={() => gallery.current?.click()} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-[15px] font-semibold"><ImageSquare className="size-6" /> Gallery</button>
            </div>
            <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={gallery} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            {photos.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {photos.map((p) => (
                  <div key={p.key} className="relative aspect-square overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt="" className="size-full object-cover" />
                    <button type="button" onClick={() => setPhotos((all) => all.filter((x) => x.key !== p.key))} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove photo"><X className="size-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && <Alert>{error}</Alert>}
          <button type="button" onClick={next} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-signal text-[17px] font-bold text-ink">
            <HandArrowDown className="size-6" weight="bold" /> Next: contractor signs
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="rounded-2xl bg-ink p-4 text-white">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-signal">Hand the phone to the site manager</p>
            <p className="mt-1 text-[18px] font-semibold leading-snug">{effectiveTitle}</p>
            <p className="text-[13px] text-white/60">{jobName}{areaName ? ` · ${areaName}` : ""}</p>
            <p className="mt-2 inline-block rounded-md bg-signal px-2 py-0.5 text-[12px] font-bold text-ink">{scopeText}</p>
            {HANDOVER_TRADES.filter((t) => scopes.includes(t.id)).map((t) => (
              <div key={t.id} className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{tradeLong(t.id)}</p>
                <ul className="mt-1 grid gap-1 text-[13px]">
                  {checks.filter((c) => c.section === t.id).map((c) => (
                    <li key={c.label} className={cn("flex gap-2", !c.checked && "text-white/50")}>
                      <span>{c.checked ? "✓" : "–"}</span>{c.label}{!c.checked && " (not confirmed)"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {photos.length > 0 && <p className="mt-2 text-[12px] text-white/60">{photos.length} photo{photos.length > 1 ? "s" : ""} attached</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" htmlFor="sname"><Input id="sname" value={signer.name} onChange={(e) => setSigner({ ...signer, name: e.target.value })} autoComplete="name" /></Field>
            <Field label="Position" htmlFor="spos" optional><Input id="spos" value={signer.position} onChange={(e) => setSigner({ ...signer, position: e.target.value })} placeholder="Site Manager" /></Field>
            <Field label="Company" htmlFor="scomp"><Input id="scomp" value={signer.company} onChange={(e) => setSigner({ ...signer, company: e.target.value })} /></Field>
            <Field label="Email for a copy" htmlFor="smail" optional><Input id="smail" type="email" value={signer.email} onChange={(e) => setSigner({ ...signer, email: e.target.value })} /></Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Signature</p>
            <SignaturePad ref={pad} onChange={setHasInk} />
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-ink" />
            <span className="text-[14px] leading-snug">{declaration}</span>
          </label>
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => { setStep(1); setError(null); }} className="h-14 rounded-xl border border-line-strong bg-card px-5 font-semibold">Back</button>
            <button type="button" onClick={submit} disabled={busy || !hasInk || !confirmed}
              className="h-14 rounded-xl bg-ok text-[17px] font-bold text-white disabled:opacity-40">{busy ? "Saving…" : "Sign & submit"}</button>
          </div>
        </>
      )}
    </div>
  );
}
