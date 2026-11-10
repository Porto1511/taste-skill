"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, Plus, Trash, PenNib, HandArrowDown } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Alert, Field, Input, Textarea } from "@/components/ui/form";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import { DAYS, DAYWORK_DECLARATION } from "@/lib/handover";

type DayId = (typeof DAYS)[number]["id"];
type Worker = { name: string; trade: string; hours: Record<DayId, string> };
type Client = { name: string; position: string; company: string; email: string };

const emptyHours = () => Object.fromEntries(DAYS.map((d) => [d.id, ""])) as Record<DayId, string>;
const total = (w: Worker) => DAYS.reduce((s, d) => s + (Number(w.hours[d.id]) || 0), 0);
/** Rows shown to start with, like the blank lines on the paper sheet. Empty rows are ignored. */
const START_ROWS = 4;
const isBlank = (w: Worker) => !w.name.trim() && total(w) === 0;

export function DayworkForm({ jobId, week, me, myHours, defaultClient }: {
  jobId: string; week: string; me: { name: string; trade: string }; myHours: Partial<Record<DayId, number>>; defaultClient: Client;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [weekCommencing, setWeek] = useState(week);
  const [workers, setWorkers] = useState<Worker[]>([{
    name: me.name, trade: me.trade,
    hours: Object.fromEntries(DAYS.map((d) => [d.id, myHours[d.id] ? String(myHours[d.id]) : ""])) as Record<DayId, string>,
  }, ...Array.from({ length: START_ROWS - 1 }, () => ({ name: "", trade: "", hours: emptyHours() }))]);
  const [kind, setKind] = useState<"standing" | "extra" | "">("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState("");
  const [complete, setComplete] = useState<"yes" | "no" | "">("");
  const [client, setClient] = useState<Client>(defaultClient);
  const [mswSig, setMswSig] = useState<Blob | null>(null);
  const [mswInk, setMswInk] = useState(false);
  const [clientInk, setClientInk] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mswPad = useRef<SignaturePadHandle>(null);
  const clientPad = useRef<SignaturePadHandle>(null);

  const filled = workers.filter((w) => !isBlank(w));
  const setWorker = (i: number, patch: Partial<Worker>) => setWorkers((all) => all.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const goTo = (n: 1 | 2 | 3) => { setError(null); setStep(n); window.scrollTo({ top: 0 }); };

  function nextFromDetails() {
    if (!filled.length) return setError("Enter who worked and their hours.");
    if (filled.some((w) => w.name.trim().length < 2)) return setError("Enter the name for each person with hours.");
    const noHours = filled.find((w) => total(w) === 0);
    if (noHours) return setError(`Enter the hours for ${noHours.name.trim()}, or clear their name.`);
    if (filled.some((w) => DAYS.some((d) => { const v = Number(w.hours[d.id] || 0); return v < 0 || v > 24 || Math.round(v * 4) !== v * 4; })))
      return setError("Hours must be between 0 and 24, in quarter hours.");
    if (!kind) return setError("Is it standing time or extra work?");
    if (description.trim().length < 3) return setError("Describe the work.");
    if (!complete) return setError("Is the work complete? Choose yes or no.");
    goTo(2);
  }

  async function nextFromMsw() {
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
    fd.set("weekCommencing", weekCommencing);
    fd.set("workers", JSON.stringify(filled.map((w) => ({ name: w.name, trade: w.trade, hours: Object.fromEntries(DAYS.map((d) => [d.id, Number(w.hours[d.id]) || 0])) }))));
    fd.set("kind", kind);
    fd.set("description", description);
    fd.set("materials", materials);
    fd.set("workComplete", complete);
    fd.set("clientName", client.name);
    fd.set("clientCompany", client.company);
    fd.set("clientPosition", client.position);
    fd.set("clientEmail", client.email);
    fd.set("confirmed", "1");
    fd.set("signature", sig, "client.png");
    fd.set("mswSignature", mswSig, "msw.png");
    setBusy(true);
    try {
      const res = await fetch("/api/dayworks", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201 && body.href) {
        router.push(`${body.href}?signed=1`);
        router.refresh();
        return;
      }
      setError(body.error ?? "The daywork sheet could not be saved.");
    } catch {
      setError("No connection — nothing has been saved yet. Move to better signal and tap Sign & submit again.");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-5">
      <ol className="grid grid-cols-3 gap-1.5 text-[12.5px] font-semibold">
        {["Details", "MSW signs", "Client signs"].map((s, i) => (
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
          <Field label="Week commencing" htmlFor="week"><Input id="week" type="date" value={weekCommencing} onChange={(e) => setWeek(e.target.value)} /></Field>

          <div className="grid gap-3">
            <p className="text-sm font-semibold">Who and hours <span className="font-normal text-muted">— leave spare rows blank</span></p>
            {workers.map((w, i) => (
              <fieldset key={i} className="grid gap-3 rounded-2xl border border-line bg-card p-3">
                <div className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
                  <Field label={`Name ${i + 1}`} htmlFor={`n${i}`}><Input id={`n${i}`} value={w.name} onChange={(e) => setWorker(i, { name: e.target.value })} /></Field>
                  <Field label="Trade" htmlFor={`t${i}`}><Input id={`t${i}`} value={w.trade} onChange={(e) => setWorker(i, { trade: e.target.value })} placeholder="Deck" /></Field>
                  {workers.length > START_ROWS ? (
                    <button type="button" onClick={() => setWorkers((all) => all.filter((_, j) => j !== i))} className="grid size-12 place-items-center rounded-xl text-danger" aria-label={`Remove ${w.name || "person"}`}><Trash className="size-5" /></button>
                  ) : <span className="w-12" />}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map((d) => (
                    <label key={d.id} className="grid gap-0.5 text-center text-[11px] font-bold text-muted">
                      {d.short}
                      <input inputMode="decimal" value={w.hours[d.id]} onChange={(e) => setWorker(i, { hours: { ...w.hours, [d.id]: e.target.value.replace(/[^\d.]/g, "") } })}
                        aria-label={`${w.name || `Person ${i + 1}`} hours ${d.label}`} placeholder="–"
                        className="h-12 w-full rounded-lg border border-line-strong bg-white text-center text-[16px] font-semibold text-ink tabular focus:border-ink focus:outline-none" />
                    </label>
                  ))}
                </div>
                <p className="text-right text-[13px] text-muted">Total <span className="tabular font-bold text-ink">{total(w)}h</span></p>
              </fieldset>
            ))}
            <button type="button" onClick={() => setWorkers((all) => [...all, { name: "", trade: "", hours: emptyHours() }])}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/30 bg-card text-[15px] font-semibold">
              <Plus className="size-5" weight="bold" /> Add another person
            </button>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What is it?</legend>
            <div className="grid grid-cols-2 gap-2">
              {([["standing", "Standing time"], ["extra", "Extra work"]] as const).map(([v, label]) => (
                <button key={v} type="button" aria-pressed={kind === v} onClick={() => setKind(v)}
                  className={cn("h-12 rounded-xl border text-[15px] font-semibold", kind === v ? "border-ink bg-ink text-white" : "border-line-strong bg-card")}>{label}</button>
              ))}
            </div>
          </fieldset>
          <Field label="Description of work" htmlFor="desc">
            <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000}
              placeholder={kind === "extra" ? "e.g. Extra edge trim to new riser at D4, instructed by site manager" : "e.g. Hoist out of service, gang waiting from 07:30 to 10:00"} />
          </Field>
          <Field label="Materials used" htmlFor="mat" optional>
            <Textarea id="mat" rows={2} className="min-h-0" value={materials} onChange={(e) => setMaterials(e.target.value)} maxLength={2000} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Is the work complete?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["yes", "no"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={complete === v} onClick={() => setComplete(v)}
                  className={cn("h-12 rounded-xl border text-[15px] font-semibold capitalize", complete === v ? "border-ink bg-ink text-white" : "border-line-strong bg-card")}>{v}</button>
              ))}
            </div>
          </fieldset>
          {error && <Alert>{error}</Alert>}
          <button type="button" onClick={nextFromDetails} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-signal text-[17px] font-bold text-ink">
            <PenNib className="size-6" weight="bold" /> Next: MSW signs
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <DayworkSummary workers={filled} description={description} complete={complete} kind={kind} />
          <div>
            <p className="mb-2 text-sm font-semibold">Signed MSW — {me.name}</p>
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
            <p className="mt-1 text-[14px] text-white/70">Please check the hours below, then print your name and sign.</p>
          </div>
          <DayworkSummary workers={filled} description={description} complete={complete} kind={kind} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Print name" htmlFor="cname"><Input id="cname" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></Field>
            <Field label="Position" htmlFor="cpos" optional><Input id="cpos" value={client.position} onChange={(e) => setClient({ ...client, position: e.target.value })} /></Field>
            <Field label="Company" htmlFor="ccomp"><Input id="ccomp" value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} /></Field>
            <Field label="Email for your copy" htmlFor="cmail" optional><Input id="cmail" type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Signed client</p>
            <SignaturePad ref={clientPad} onChange={setClientInk} />
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-ink" />
            <span className="text-[14px] leading-snug">{DAYWORK_DECLARATION}</span>
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

function DayworkSummary({ workers, description, complete, kind }: { workers: Worker[]; description: string; complete: string; kind: string }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-line bg-card p-4 text-[14px]">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Daywork sheet · {kind === "standing" ? "Standing time" : "Extra work"}</p>
      {workers.map((w, i) => (
        <p key={i} className="flex justify-between gap-2"><span><span className="font-semibold">{w.name}</span> <span className="text-muted">{w.trade}</span></span>
          <span className="tabular font-bold">{total(w)}h</span></p>
      ))}
      <p className="border-t border-line pt-2">{description}</p>
      <p className="text-muted">Work complete: <span className="font-semibold capitalize text-ink">{complete}</span></p>
    </div>
  );
}
