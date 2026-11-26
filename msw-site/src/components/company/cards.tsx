"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { Camera, FilePdf, PaperPlaneTilt, Trash, UploadSimple, IdentificationCard } from "@phosphor-icons/react";
import type { CardRow } from "@/server/queries/company";
import { deleteCardAction } from "@/server/actions/company";
import { CARD_TYPES, expiryState } from "@/lib/cards";
import { compressImage } from "@/lib/compress-image";
import { idle } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { Alert, Field, Input } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Open the phone's share sheet with the file (Mail, WhatsApp, Print, Files); a download elsewhere. */
async function sendFile(url: string, fileName: string, title: string) {
  const blob = await (await fetch(url)).blob();
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}

export function ExpiryBadge({ expiresOn, today }: { expiresOn: string | null; today: string }) {
  const s = expiryState(expiresOn, today);
  if (s === "none") return <span className="text-[13px] text-muted">No expiry date</span>;
  const label = s === "expired" ? `Expired ${formatDate(expiresOn!)}` : `Expires ${formatDate(expiresOn!)}`;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[12.5px] font-semibold",
      s === "expired" ? "bg-danger-soft text-danger" : s === "soon" ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")}>{label}</span>
  );
}

/** A person's cards: view, send or print each one; the manager/office can remove them. */
export function CardList({ cards, today, canEdit, owner }: { cards: CardRow[]; today: string; canEdit: boolean; owner: string }) {
  if (!cards.length) return <p className="px-1 text-[14px] text-muted">No cards added yet.</p>;
  return (
    <ul className="grid gap-2">
      {cards.map((c) => <CardItem key={c.id} card={c} today={today} canEdit={canEdit} owner={owner} />)}
    </ul>
  );
}

function CardItem({ card, today, canEdit, owner }: { card: CardRow; today: string; canEdit: boolean; owner: string }) {
  const [state, del, deleting] = useActionState(deleteCardAction, idle);
  const url = `/api/files/cards/${card.id}`;
  const ext = card.mime_type === "application/pdf" ? "pdf" : "jpg";
  const fileName = `${owner} - ${card.card_type}.${ext}`.replace(/[^\w.\- ]+/g, "");
  return (
    <li className="rounded-2xl bg-card p-3 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-paper ring-1 ring-line" aria-label={`Open ${card.card_type}`}>
          {ext === "jpg"
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={url} alt="" className="size-full object-cover" />
            : <FilePdf className="size-7 text-brand" />}
        </a>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{card.card_type}</p>
          {card.card_number && <p className="font-mono text-[13px] text-muted">{card.card_number}</p>}
          <div className="mt-1"><ExpiryBadge expiresOn={card.expires_on} today={today} /></div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}><IdentificationCard className="size-4" /> Show</a>
        <button type="button" onClick={() => { sendFile(url, fileName, `${owner} — ${card.card_type}`).catch(() => {}); }} className={buttonClass("secondary", "sm")}>
          <PaperPlaneTilt className="size-4" /> Send or print
        </button>
        {canEdit && (
          <form action={del} onSubmit={(e) => { if (!confirm(`Remove ${card.card_type}?`)) e.preventDefault(); }} className="ml-auto">
            <input type="hidden" name="cardId" value={card.id} />
            <button disabled={deleting} className={buttonClass("ghost", "sm", "text-danger")} aria-label={`Remove ${card.card_type}`}><Trash className="size-4" /></button>
          </form>
        )}
      </div>
      {state.error && <div className="mt-2"><Alert>{state.error}</Alert></div>}
    </li>
  );
}

/** Add a card: pick what it is, the number and expiry, then a photo of it or a PDF. */
export function AddCard({ userId }: { userId: string }) {
  const router = useRouter();
  const [type, setType] = useState("");
  const [number, setNumber] = useState("");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<{ blob: Blob; name: string; preview: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) return setFile({ blob: f, name: f.name, preview: null });
    const blob = await compressImage(f);
    setFile({ blob, name: "card.jpg", preview: URL.createObjectURL(blob) });
  }

  async function save() {
    setError(null);
    if (type.trim().length < 2) return setError("Say what the card is, e.g. CSCS card.");
    if (!file) return setError("Take a photo of the card or choose a PDF.");
    const fd = new FormData();
    fd.set("userId", userId); fd.set("cardType", type); fd.set("cardNumber", number); fd.set("expiresOn", expires);
    fd.set("file", file.blob, file.name);
    setBusy(true);
    const res = await fetch("/api/cards", { method: "POST", body: fd }).catch(() => null);
    setBusy(false);
    if (!res) return setError("No connection — nothing saved. Try again.");
    if (res.status === 413) return setError("That file is too big. Take a photo instead, or use a smaller PDF.");
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "The card could not be saved.");
    setType(""); setNumber(""); setExpires(""); setFile(null);
    router.refresh();
  }

  return (
    <div className="grid gap-3 rounded-2xl bg-paper p-4 ring-1 ring-line">
      <p className="font-semibold">Add a card or ticket</p>
      <Field label="What is it?" htmlFor="cardType">
        <Input id="cardType" list="card-types" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. CSCS card" maxLength={80} />
        <datalist id="card-types">{CARD_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Card number" htmlFor="cardNumber" optional><Input id="cardNumber" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={80} /></Field>
        <Field label="Expiry date" htmlFor="expiresOn" optional><Input id="expiresOn" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
      </div>
      {file?.preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.preview} alt="The card" className="max-h-48 w-auto rounded-xl object-contain ring-1 ring-line" />
      )}
      {file && !file.preview && <p className="flex items-center gap-2 text-[14px]"><FilePdf className="size-5 text-brand" /> {file.name}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => camera.current?.click()} className={buttonClass("dark", "md")}><Camera className="size-5" weight="fill" /> Take photo</button>
        <button type="button" onClick={() => pdf.current?.click()} className={buttonClass("secondary", "md")}><FilePdf className="size-5" /> Choose PDF</button>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Photo of the card" onChange={(e) => pick(e.target.files?.[0])} />
        <input ref={pdf} type="file" accept="application/pdf,.pdf,image/*" className="sr-only" aria-label="Choose a PDF or photo of the card" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {error && <Alert>{error}</Alert>}
      <button type="button" onClick={save} disabled={busy} className={buttonClass("primary", "lg")}><UploadSimple className="size-5" weight="bold" /> {busy ? "Saving…" : "Save card"}</button>
    </div>
  );
}
