"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Check, HandArrowDown, Images, PenNib, Plus, Trash, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { compressImage } from "@/lib/compress-image";
import { VARIATION_DECLARATION } from "@/lib/handover";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { PrintName, SignaturePad, type SignaturePadHandle } from "./signature-pad";

type Client = { name: string; position: string; company: string; email: string };
type Photo = { key: string; blob: Blob; url: string; caption: string };
const MAX_PHOTOS = 8;
const START_ROWS = 3;

/** What the client asked for, photos, the operative signs, then the client. */
export function VariationForm({ jobId, areas, me, defaultClient }: {
  jobId: string; areas: { id: string; name: string }[]; me: string; defaultClient: Client;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [areaId, setAreaId] = useState("");
  const [description, setDescription] = useState("");
  const [requestedBy, setRequestedBy] = useState(defaultClient.name);
  const [operatives, setOperatives] = useState<string[]>([me, ...Array(START_ROWS - 1).fill("")]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [client, setClient] = useState<Client>(defaultClient);
  const [opPrint, setOpPrint] = useState(me);
  const [opSig, setOpSig] = useState<Blob | null>(null);
  const [opInk, setOpInk] = useState(false);
  const [clientInk, setClientInk] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opPad = useRef<SignaturePadHandle>(null);
  const clientPad = useRef<SignaturePadHandle>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const names = operatives.map((n) => n.trim()).filter(Boolean);
  const goTo = (n: 1 | 2 | 3) => { setError(null); setStep(n); window.scrollTo({ top: 0 }); };

  async function addPhotos(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).slice(0, MAX_PHOTOS - photos.length);
    const added = await Promise.all(files.map(async (f, i) => {
      const blob = await compressImage(f);
      return { key: `${Date.now()}-${i}`, blob, url: URL.createObjectURL(blob), caption: "" };
    }));
    setPhotos((p) => [...p, ...added]);
  }

  function nextFromDetails() {
    if (description.trim().length < 3) return setError("Say what the client has asked for.");
    if (requestedBy.trim().length < 2) return setError("Who asked for it?");
    if (!names.length) return setError("Put the names of the lads doing it.");
    if (names.some((n) => n.length < 2)) return setError("Check the operatives' names.");
    goTo(2);
  }

  async function nextFromOperative() {
    if (opPrint.trim().length < 2) return setError("Print your name.");
    if (!opPad.current || opPad.current.isEmpty()) return setError("Sign in the box.");
    setOpSig(await opPad.current.toBlob());
    goTo(3);
  }

  async function submit() {
    setError(null);
    if (client.name.trim().length < 2) return setError("The client needs to print their name.");
    if (client.company.trim().length < 2) return setError("Enter the client's company.");
    if (!clientPad.current || clientPad.current.isEmpty()) return setError("The client needs to sign in the box.");
    if (!confirmed) return setError("Tick the confirmation.");
    const sig = await clientPad.current.toBlob();
    if (!sig || !opSig) return setError("A signature could not be captured. Please try again.");
    const fd = new FormData();
    fd.set("jobId", jobId); fd.set("areaId", areaId); fd.set("description", description); fd.set("requestedBy", requestedBy);
    fd.set("operatives", JSON.stringify(names)); fd.set("operativeName", opPrint);
    fd.set("clientName", client.name); fd.set("clientCompany", client.company); fd.set("clientPosition", client.position); fd.set("clientEmail", client.email);
    fd.set("confirmed", "1");
    fd.set("signature", sig, "client.png"); fd.set("operativeSignature", opSig, "operative.png");
    photos.forEach((p, i) => { fd.append("photos", p.blob, `photo-${i + 1}.jpg`); fd.append("captions", p.caption); });
    setBusy(true);
    try {
      const res = await fetch("/api/variations", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201 && body.href) { router.push(`${body.href}?signed=1`); router.refresh(); return; }
      setError(res.status === 413 ? "Too much to send in one go — remove a photo or two and try again." : body.error ?? "The variation could not be saved.");
    } catch {
      setError("No connection — nothing has been saved yet. Move to better signal and tap Sign & submit again.");
    }
    setBusy(false);
  }

  const summary = (
    <div className="grid gap-2 rounded-2xl border border-line bg-card p-4 text-[14px]">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Variation{areaId ? ` · ${areas.find((a) => a.id === areaId)?.name}` : ""}</p>
      <p className="font-semibold">{description}</p>
      <p className="text-muted">Asked for by <span className="font-semibold text-ink">{requestedBy}</span></p>
      <p className="text-muted">Operatives: <span className="text-ink">{names.join(", ")}</span></p>
      {photos.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photos.map((p) => <img key={p.key} src={p.url} alt={p.caption || "Photo"} className="size-14 shrink-0 rounded-lg object-cover" />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-5">
      <ol className="grid grid-cols-3 gap-1.5 text-[12.5px] font-semibold">
        {["Details", "Operative signs", "Client signs"].map((s, i) => (
          <li key={s} className={cn("flex items-center gap-1.5 rounded-xl px-2.5 py-2", step === i + 1 ? "bg-ink text-white" : "bg-ink/[0.06] text-muted")}>
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[12px]", step > i + 1 ? "bg-ok text-white" : step === i + 1 ? "bg-brand text-white" : "bg-ink/10")}>
              {step > i + 1 ? <Check className="size-3" weight="bold" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <>
          {areas.length > 0 && (
            <Field label="Where?" htmlFor="area">
              <Select id="area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">Whole job / not one area</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="What has the client asked for?" htmlFor="desc">
            <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000}
              placeholder="e.g. Extra nets to the new lift shaft void at grid D4, not on the drawing" />
          </Field>
          <Field label="Who asked for it?" htmlFor="reqby" hint="Their name, e.g. the site manager">
            <Input id="reqby" value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} maxLength={120} />
          </Field>

          <div className="grid gap-2">
            <p className="text-sm font-semibold">Operatives doing it <span className="font-normal text-muted">— leave spare rows blank</span></p>
            {operatives.map((n, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-2">
                <Input aria-label={`Operative ${i + 1}`} value={n} onChange={(e) => setOperatives((all) => all.map((x, j) => (j === i ? e.target.value : x)))} maxLength={120} />
                {operatives.length > START_ROWS
                  ? <button type="button" onClick={() => setOperatives((all) => all.filter((_, j) => j !== i))} className="grid size-12 place-items-center rounded-xl text-danger" aria-label={`Remove operative ${i + 1}`}><Trash className="size-5" /></button>
                  : <span className="w-12" />}
              </div>
            ))}
            <button type="button" onClick={() => setOperatives((all) => [...all, ""])} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/30 bg-card text-[15px] font-semibold">
              <Plus className="size-5" weight="bold" /> Add another
            </button>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-semibold">Photos <span className="font-normal text-muted">{photos.length}/{MAX_PHOTOS}</span></p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={photos.length >= MAX_PHOTOS} onClick={() => camera.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white disabled:opacity-40"><Camera className="size-5" weight="fill" /> Take photo</button>
              <button type="button" disabled={photos.length >= MAX_PHOTOS} onClick={() => gallery.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-[15px] font-semibold disabled:opacity-40"><Images className="size-5" /> From gallery</button>
              <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a photo" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
              <input ref={gallery} type="file" accept="image/*" multiple className="sr-only" aria-label="Choose photos" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </div>
            {photos.map((p, i) => (
              <div key={p.key} className="grid grid-cols-[4rem_1fr_auto] items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="size-16 rounded-xl object-cover" />
                <Input aria-label={`Caption for photo ${i + 1}`} placeholder={`Caption for photo ${i + 1} (optional)`} value={p.caption} maxLength={300}
                  onChange={(e) => setPhotos((all) => all.map((x) => (x.key === p.key ? { ...x, caption: e.target.value } : x)))} />
                <button type="button" onClick={() => setPhotos((all) => all.filter((x) => x.key !== p.key))} className="grid size-11 place-items-center rounded-xl text-danger" aria-label={`Remove photo ${i + 1}`}><X className="size-5" /></button>
              </div>
            ))}
          </div>
          {error && <Alert>{error}</Alert>}
          <button type="button" onClick={nextFromDetails} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-brand text-[17px] font-bold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]">
            <PenNib className="size-6" weight="bold" /> Next: operative signs
          </button>
        </>
      )}

      {step === 2 && (
        <>
          {summary}
          <div>
            <PrintName id="opname" label="Operative — print name" value={opPrint} onChange={setOpPrint} />
            <p className="mb-2 mt-3 text-sm font-semibold">Signature</p>
            <SignaturePad ref={opPad} onChange={setOpInk} />
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => goTo(1)} className="h-14 rounded-xl border border-line-strong bg-card px-5 font-semibold">Back</button>
            <button type="button" onClick={nextFromOperative} disabled={!opInk} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-brand text-[17px] font-bold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)] disabled:opacity-40">
              <HandArrowDown className="size-6" weight="bold" /> Next: client signs
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="rounded-2xl bg-ink p-4 text-white">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-signal">Hand the phone to the client</p>
            <p className="mt-1 text-[14px] text-white/70">Please check what you&apos;ve asked for below, then print your name and sign.</p>
          </div>
          {summary}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Position" htmlFor="cpos" optional><Input id="cpos" value={client.position} onChange={(e) => setClient({ ...client, position: e.target.value })} /></Field>
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
            <span className="text-[14px] leading-snug">{VARIATION_DECLARATION}</span>
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
