"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, ImageSquare, X, Check, HandArrowDown, PenNib } from "@phosphor-icons/react";
import { compressImage } from "@/lib/compress-image";
import { cn } from "@/lib/cn";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { PrintName, SignaturePad, type SignaturePadHandle } from "./signature-pad";
import { CLIENT_DECLARATION, DAYS, HANDOVER_TRADES, NOTES_FIELD, scopeSummary } from "@/lib/handover";
import { dayIdOf, londonToday, mondayOf } from "@/lib/week";

type Photo = { key: string; blob: Blob; preview: string };
type Client = { name: string; position: string; company: string; email: string };

export function HandoverForm({ jobId, jobName, areas, defaultClient, mswName }: {
  jobId: string; jobName: string; areas: { id: string; name: string }[];
  defaultClient: Client; mswName: string;
}) {
  const router = useRouter();
  const today = londonToday();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scopes, setScopes] = useState<string[]>([]);
  const [areaId, setAreaId] = useState(areas.length === 1 ? areas[0].id : "");
  const [details, setDetails] = useState<Record<string, Record<string, string>>>({});
  const [days, setDays] = useState<string[]>([dayIdOf(today)]);
  const [week, setWeek] = useState(mondayOf(today));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [client, setClient] = useState<Client>(defaultClient);
  const [mswPrint, setMswPrint] = useState(mswName);
  const [mswSig, setMswSig] = useState<Blob | null>(null);
  const [mswInk, setMswInk] = useState(false);
  const [clientInk, setClientInk] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mswPad = useRef<SignaturePadHandle>(null);
  const clientPad = useRef<SignaturePadHandle>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const areaName = areas.find((a) => a.id === areaId)?.name;
  const trades = HANDOVER_TRADES.filter((t) => scopes.includes(t.id));
  const title = scopes.length ? `${areaName ?? "Whole job"} — ${scopes.length === 3 ? "full handover" : `${scopeSummary(scopes).toLowerCase()} handover`}` : "";
  const setField = (trade: string, key: string, value: string) =>
    setDetails((d) => ({ ...d, [trade]: { ...d[trade], [key]: value } }));
  const toggleTrade = (id: string) => {
    const next = scopes.includes(id) ? scopes.filter((x) => x !== id) : [...scopes, id];
    setScopes(HANDOVER_TRADES.map((t) => t.id).filter((x) => next.includes(x)));
    // Sensible defaults from the chosen area.
    if (!scopes.includes(id) && areaName) {
      if (id === "netting" && !details.netting?.gridlines) setField("netting", "gridlines", areaName);
      if (id === "studs" && !details.studs?.floorLevel) setField("studs", "floorLevel", areaName);
      if (id === "deck" && !details.deck?.area) setField("deck", "area", areaName);
    }
  };

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).slice(0, 8 - photos.length);
    const added = await Promise.all(files.map(async (f) => {
      const blob = await compressImage(f);
      return { key: `${f.name}-${Math.random()}`, blob, preview: URL.createObjectURL(blob) };
    }));
    setPhotos((p) => [...p, ...added]);
  }

  function goTo(n: 1 | 2 | 3) {
    setError(null);
    setStep(n);
    window.scrollTo({ top: 0 });
  }

  function nextFromWork() {
    if (!scopes.length) return setError("Choose what you're handing over: nets, deck or studs.");
    for (const t of trades) {
      for (const f of t.fields) {
        const v = details[t.id]?.[f.key]?.trim();
        if (f.required && !v) return setError(`${t.long}: enter ${f.label.toLowerCase()}.`);
        if (f.numeric && v && !/^\d{1,7}$/.test(v)) return setError(`${t.long}: ${f.label.toLowerCase()} must be a number.`);
      }
    }
    if (!days.length) return setError("Tick the days worked.");
    goTo(2);
  }

  async function nextFromMsw() {
    if (mswPrint.trim().length < 2) return setError("Print the name of the MSW person signing.");
    if (!mswPad.current || mswPad.current.isEmpty()) return setError("Sign in the box for MSW.");
    setMswSig(await mswPad.current.toBlob());
    goTo(3);
  }

  async function submit() {
    setError(null);
    if (client.name.trim().length < 2) return setError("The client needs to print their name.");
    if (client.company.trim().length < 2) return setError("Enter the client's company.");
    if (!clientPad.current || clientPad.current.isEmpty()) return setError("The client needs to sign in the box.");
    if (!confirmed) return setError("Tick the confirmation.");
    const sig = await clientPad.current.toBlob();
    if (!sig || !mswSig) return setError("A signature could not be captured. Please try again.");
    const fd = new FormData();
    fd.set("jobId", jobId);
    if (areaId) fd.set("areaId", areaId);
    fd.set("title", title);
    scopes.forEach((s) => fd.append("scopes", s));
    fd.set("details", JSON.stringify(details));
    days.forEach((d) => fd.append("daysWorked", d));
    fd.set("weekCommencing", week);
    fd.set("mswName", mswPrint);
    fd.set("signerName", client.name);
    fd.set("signerCompany", client.company);
    fd.set("signerPosition", client.position);
    fd.set("signerEmail", client.email);
    fd.set("confirmed", "1");
    fd.set("signature", sig, "client.png");
    fd.set("mswSignature", mswSig, "msw.png");
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
      setError(body.error ?? "The certificate could not be saved.");
    } catch {
      setError("No connection — nothing has been saved yet. Move to better signal and tap Sign & submit again.");
    }
    setBusy(false);
  }

  const steps = ["The work", "MSW signs", "Client signs"];

  return (
    <div className="grid gap-5">
      <ol className="grid grid-cols-3 gap-1.5 text-[12.5px] font-semibold">
        {steps.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-1.5 rounded-xl px-2.5 py-2", step === i + 1 ? "bg-ink text-white" : "bg-ink/[0.06] text-muted")}>
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px]", step > i + 1 ? "bg-ok text-white" : step === i + 1 ? "bg-signal text-ink" : "bg-ink/10")}>
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
                  <button key={t.id} type="button" aria-pressed={on} onClick={() => toggleTrade(t.id)}
                    className={cn("flex h-16 flex-col items-center justify-center rounded-xl border-2 text-[16px] font-bold", on ? "border-ink bg-ink text-white" : "border-line-strong bg-card")}>
                    {on && <Check className="mb-0.5 size-4 text-signal" weight="bold" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => { if (scopes.length === 3) setScopes([]); else HANDOVER_TRADES.forEach((t) => !scopes.includes(t.id) && toggleTrade(t.id)); }}
              className={cn("mt-2 h-12 w-full rounded-xl border-2 text-[15px] font-bold", scopes.length === 3 ? "border-signal bg-signal text-ink" : "border-dashed border-ink/30 bg-card")}>
              {scopes.length === 3 ? "✓ Full handover — nets, deck & studs" : "Full handover (all three)"}
            </button>
          </fieldset>

          <Field label="Area" htmlFor="area">
            <Select id="area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Whole job ({jobName})</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>

          {trades.map((t) => (
            <fieldset key={t.id} className="grid gap-3 rounded-2xl border border-line bg-card p-4">
              <legend className="px-1 text-[13px] font-bold uppercase tracking-[0.06em]">{t.long} certificate</legend>
              {t.fields.map((f) => (
                <Field key={f.key} label={f.label} htmlFor={`${t.id}-${f.key}`} optional={!f.required}>
                  {f.multiline
                    ? <Textarea id={`${t.id}-${f.key}`} rows={2} className="min-h-0" value={details[t.id]?.[f.key] ?? ""} placeholder={f.placeholder}
                        onChange={(e) => setField(t.id, f.key, e.target.value)} maxLength={2000} />
                    : <Input id={`${t.id}-${f.key}`} value={details[t.id]?.[f.key] ?? ""} placeholder={f.placeholder} inputMode={f.numeric ? "numeric" : undefined}
                        onChange={(e) => setField(t.id, f.key, e.target.value)} maxLength={200} />}
                </Field>
              ))}
              <Field label={NOTES_FIELD.label} htmlFor={`${t.id}-notes`} optional>
                <Textarea id={`${t.id}-notes`} rows={2} className="min-h-0" value={details[t.id]?.notes ?? ""} placeholder={NOTES_FIELD.placeholder}
                  onChange={(e) => setField(t.id, "notes", e.target.value)} maxLength={2000} />
              </Field>
              <p className="rounded-lg bg-paper p-2.5 text-[12.5px] leading-snug text-muted">{t.statement}</p>
            </fieldset>
          ))}

          {scopes.length > 0 && (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Days worked</legend>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map((d) => {
                    const on = days.includes(d.id);
                    return (
                      <button key={d.id} type="button" aria-pressed={on} aria-label={d.label}
                        onClick={() => setDays((all) => (on ? all.filter((x) => x !== d.id) : [...all, d.id]))}
                        className={cn("flex h-14 flex-col items-center justify-center rounded-xl border text-[12px] font-bold", on ? "border-ink bg-ink text-white" : "border-line-strong bg-card")}>
                        {d.short}
                        {on ? <Check className="size-4 text-signal" weight="bold" /> : <span className="size-4" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <Field label="W/C date" htmlFor="week" hint="Week commencing (Monday)">
                <Input id="week" type="date" value={week} onChange={(e) => setWeek(e.target.value)} />
              </Field>

              <div>
                <p className="mb-2 text-sm font-semibold">Photos <span className="font-normal text-subtle">optional · {photos.length}/8</span></p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => camera.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white"><Camera className="size-5" weight="fill" /> Take photo</button>
                  <button type="button" onClick={() => gallery.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-[15px] font-semibold"><ImageSquare className="size-5" /> Gallery</button>
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
            </>
          )}
          {error && <Alert>{error}</Alert>}
          <button type="button" onClick={nextFromWork} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-signal text-[17px] font-bold text-ink">
            <PenNib className="size-6" weight="bold" /> Next: MSW signs
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <Summary title={title} trades={trades} details={details} days={days} />
          <div>
            <PrintName id="mswname" label="Signed for MSW — print name" value={mswPrint} onChange={setMswPrint} />
            <p className="mb-2 mt-3 text-sm font-semibold">Signature</p>
            <SignaturePad ref={mswPad} onChange={setMswInk} />
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => goTo(1)} className="h-14 rounded-xl border border-line-strong bg-card px-5 font-semibold">Back</button>
            <button type="button" onClick={nextFromMsw} disabled={!mswInk} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-signal text-[17px] font-bold text-ink disabled:opacity-40">
              <HandArrowDown className="size-6" weight="bold" /> Next: client signs
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="rounded-2xl bg-ink p-4 text-white">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-signal">Hand the phone to the client</p>
            <p className="mt-1 text-[14px] text-white/70">Please check the work below, then print your name and sign.</p>
          </div>
          <Summary title={title} trades={trades} details={details} days={days} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Position" htmlFor="cpos" optional><Input id="cpos" value={client.position} onChange={(e) => setClient({ ...client, position: e.target.value })} placeholder="Site Manager" /></Field>
            <Field label="Company" htmlFor="ccomp"><Input id="ccomp" value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} /></Field>
            <Field label="Email for your copy" htmlFor="cmail" optional><Input id="cmail" type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></Field>
          </div>
          <div>
            <PrintName id="cname" label="Client — print name" value={client.name} onChange={(v) => setClient({ ...client, name: v })} />
            <p className="mb-2 mt-3 text-sm font-semibold">Signature</p>
            <SignaturePad ref={clientPad} onChange={setClientInk} />
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-ink" />
            <span className="text-[14px] leading-snug">{CLIENT_DECLARATION}</span>
          </label>
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => goTo(2)} className="h-14 rounded-xl border border-line-strong bg-card px-5 font-semibold">Back</button>
            <button type="button" onClick={submit} disabled={busy || !clientInk || !confirmed} className="h-14 rounded-xl bg-ok text-[17px] font-bold text-white disabled:opacity-40">
              {busy ? "Saving…" : "Sign & submit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ title, trades, details, days }: {
  title: string; trades: typeof HANDOVER_TRADES; details: Record<string, Record<string, string>>; days: string[];
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-line bg-card p-4">
      <p className="text-[17px] font-semibold leading-snug">{title}</p>
      {trades.map((t) => (
        <div key={t.id} className="border-t border-line pt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{t.title}</p>
          <dl className="mt-1 grid gap-1 text-[14px]">
            {t.fields.map((f) => details[t.id]?.[f.key] ? <div key={f.key}><dt className="inline text-muted">{f.label}: </dt><dd className="inline font-medium">{details[t.id][f.key]}</dd></div> : null)}
            {details[t.id]?.notes && <div className="rounded-lg bg-warn-soft p-2 text-[13px] text-[#6b3300]"><span className="font-semibold">Notes: </span>{details[t.id].notes}</div>}
          </dl>
          <p className="mt-1.5 text-[12px] leading-snug text-muted">{t.statement}</p>
        </div>
      ))}
      <p className="border-t border-line pt-3 text-[13px]"><span className="text-muted">Days worked: </span>{DAYS.filter((d) => days.includes(d.id)).map((d) => d.short).join(", ")}</p>
    </div>
  );
}
