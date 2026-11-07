"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, Plus, Trash, PenNib, HandArrowDown } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Alert, Field, Input, Textarea } from "@/components/ui/form";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

type Item = { description: string; quantity: string };
type Receiver = { name: string; position: string; company: string; email: string };
export const DELIVERY_DECLARATION = "I confirm the goods listed above have been received, subject to any notes recorded.";

export function DeliveryForm({ jobId, job, me, defaultReceiver }: {
  jobId: string; job: { number: string; name: string; address: string }; me: { name: string }; defaultReceiver: Receiver;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "" }]);
  const [deliveredBy, setDeliveredBy] = useState(me.name);
  const [vehicleReg, setVehicleReg] = useState("");
  const [notes, setNotes] = useState("");
  const [receiver, setReceiver] = useState<Receiver>(defaultReceiver);
  const [driverSig, setDriverSig] = useState<Blob | null>(null);
  const [driverInk, setDriverInk] = useState(false);
  const [receiverInk, setReceiverInk] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const driverPad = useRef<SignaturePadHandle>(null);
  const receiverPad = useRef<SignaturePadHandle>(null);
  const filled = items.filter((i) => i.description.trim());
  const goTo = (n: 1 | 2 | 3) => { setError(null); setStep(n); window.scrollTo({ top: 0 }); };
  const setItem = (i: number, patch: Partial<Item>) => setItems((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit() {
    setError(null);
    if (receiver.name.trim().length < 2) return setError("The receiver needs to print their name.");
    if (receiver.company.trim().length < 2) return setError("Enter the receiver's company.");
    if (!receiverPad.current || receiverPad.current.isEmpty()) return setError("The receiver needs to sign in the box.");
    if (!confirmed) return setError("Tick the confirmation.");
    const sig = await receiverPad.current.toBlob();
    if (!sig || !driverSig) return setError("A signature could not be captured. Please try again.");
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("items", JSON.stringify(filled));
    fd.set("deliveredBy", deliveredBy);
    fd.set("vehicleReg", vehicleReg);
    fd.set("notes", notes);
    fd.set("receiverName", receiver.name);
    fd.set("receiverCompany", receiver.company);
    fd.set("receiverPosition", receiver.position);
    fd.set("receiverEmail", receiver.email);
    fd.set("confirmed", "1");
    fd.set("signature", sig, "receiver.png");
    fd.set("driverSignature", driverSig, "driver.png");
    setBusy(true);
    try {
      const res = await fetch("/api/deliveries", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201 && body.href) { router.push(`${body.href}?signed=1`); router.refresh(); return; }
      setError(body.error ?? "The delivery note could not be saved.");
    } catch {
      setError("No connection — nothing has been saved yet. Move to better signal and tap Sign & submit again.");
    }
    setBusy(false);
  }

  const summary = (
    <div className="grid gap-2 rounded-2xl border border-line bg-card p-4 text-[14px]">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Delivery note · {job.number}</p>
      <p className="font-semibold">{job.name}</p>
      <p className="text-[13px] text-muted">{job.address}</p>
      <ul className="grid gap-1 border-t border-line pt-2">
        {filled.map((it, i) => <li key={i} className="flex justify-between gap-3"><span>{it.description}</span><span className="tabular font-semibold">{it.quantity}</span></li>)}
      </ul>
      <p className="border-t border-line pt-2 text-[13px]">Delivered by <span className="font-semibold">{deliveredBy}</span>{vehicleReg ? ` · ${vehicleReg.toUpperCase()}` : ""}</p>
      {notes && <p className="rounded-lg bg-warn-soft p-2 text-[13px] text-[#6b3300]"><span className="font-semibold">Notes: </span>{notes}</p>}
    </div>
  );

  return (
    <div className="grid gap-5">
      <ol className="grid grid-cols-3 gap-1.5 text-[12.5px] font-semibold">
        {["Delivery", "Driver signs", "Receiver signs"].map((s, i) => (
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
          <div className="rounded-2xl border border-line bg-card p-4 text-[14px]">
            <p className="font-mono text-[12px] text-muted">{job.number}</p>
            <p className="font-semibold">{job.name}</p>
            <p className="text-[13px] text-muted">{job.address}</p>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-semibold">What&apos;s been delivered?</p>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2">
                <Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="e.g. MD60 deck sheets, bundle 14" aria-label={`Item ${i + 1}`} maxLength={300} />
                <Input value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} placeholder="Qty" aria-label={`Quantity ${i + 1}`} maxLength={40} />
                {items.length > 1
                  ? <button type="button" onClick={() => setItems((all) => all.filter((_, j) => j !== i))} className="grid w-11 place-items-center text-danger" aria-label={`Remove item ${i + 1}`}><Trash className="size-5" /></button>
                  : <span className="w-11" />}
              </div>
            ))}
            <button type="button" onClick={() => setItems((all) => [...all, { description: "", quantity: "" }])}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/30 bg-card text-[15px] font-semibold">
              <Plus className="size-5" weight="bold" /> Add another item
            </button>
          </div>
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <Field label="Delivered by" htmlFor="by"><Input id="by" value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} maxLength={120} /></Field>
            <Field label="Vehicle reg" htmlFor="reg" optional><Input id="reg" value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} className="font-mono uppercase" maxLength={12} /></Field>
          </div>
          <Field label="Notes (shortages / damage)" htmlFor="notes" optional>
            <Textarea id="notes" rows={2} className="min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <button type="button" onClick={() => {
            if (!filled.length) return setError("Add what's been delivered.");
            if (deliveredBy.trim().length < 2) return setError("Who delivered it?");
            goTo(2);
          }} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-signal text-[17px] font-bold text-ink">
            <PenNib className="size-6" weight="bold" /> Next: driver signs
          </button>
        </>
      )}

      {step === 2 && (
        <>
          {summary}
          <div><p className="mb-2 text-sm font-semibold">Driver — {deliveredBy}</p><SignaturePad ref={driverPad} onChange={setDriverInk} /></div>
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => goTo(1)} className="h-14 rounded-xl border border-line-strong bg-card px-5 font-semibold">Back</button>
            <button type="button" disabled={!driverInk} onClick={async () => {
              if (!driverPad.current || driverPad.current.isEmpty()) return setError("Sign in the box.");
              setDriverSig(await driverPad.current.toBlob()); goTo(3);
            }} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-signal text-[17px] font-bold text-ink disabled:opacity-40">
              <HandArrowDown className="size-6" weight="bold" /> Next: receiver signs
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="rounded-2xl bg-ink p-4 text-white">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-signal">Hand the phone to the person receiving the delivery</p>
            <p className="mt-1 text-[14px] text-white/70">Check the goods below, then print your name and sign.</p>
          </div>
          {summary}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Print name" htmlFor="rname"><Input id="rname" value={receiver.name} onChange={(e) => setReceiver({ ...receiver, name: e.target.value })} /></Field>
            <Field label="Position" htmlFor="rpos" optional><Input id="rpos" value={receiver.position} onChange={(e) => setReceiver({ ...receiver, position: e.target.value })} /></Field>
            <Field label="Company" htmlFor="rcomp"><Input id="rcomp" value={receiver.company} onChange={(e) => setReceiver({ ...receiver, company: e.target.value })} /></Field>
            <Field label="Email for your copy" htmlFor="rmail" optional><Input id="rmail" type="email" value={receiver.email} onChange={(e) => setReceiver({ ...receiver, email: e.target.value })} /></Field>
          </div>
          <div><p className="mb-2 text-sm font-semibold">Received by</p><SignaturePad ref={receiverPad} onChange={setReceiverInk} /></div>
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-ink" />
            <span className="text-[14px] leading-snug">{DELIVERY_DECLARATION}</span>
          </label>
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => goTo(2)} className="h-14 rounded-xl border border-line-strong bg-card px-5 font-semibold">Back</button>
            <button type="button" onClick={submit} disabled={busy || !receiverInk || !confirmed} className="h-14 rounded-xl bg-ok text-[17px] font-bold text-white disabled:opacity-40">
              {busy ? "Saving…" : "Sign & submit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
