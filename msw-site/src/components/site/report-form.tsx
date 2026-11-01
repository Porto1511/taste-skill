"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Camera, ImageSquare, X, WarningOctagon, TrendUp, Images, Clock, Door, Barricade, Package, FileMagnifyingGlass,
  FirstAidKit, DotsThree, Phone,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { telHref } from "@/lib/format";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";

type Kind = "issue" | "progress" | "photo";
type Photo = { key: string; file: Blob; name: string; preview: string; caption: string };

const categories = [
  { id: "delay", label: "Delay", icon: Clock },
  { id: "access", label: "Access problem", icon: Door },
  { id: "edge_protection", label: "Missing edge protection", icon: Barricade },
  { id: "materials", label: "Materials problem", icon: Package },
  { id: "drawing_query", label: "Drawing query", icon: FileMagnifyingGlass },
  { id: "safety", label: "Safety concern", icon: FirstAidKit },
  { id: "other", label: "Other", icon: DotsThree },
] as const;

const MAX_PHOTOS = 8;

/** Downscale and re-encode in the browser: faster uploads on weak site signal. */
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const max = 2000;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // the server validates and re-encodes anyway
  }
}

export function ReportForm({ jobId, jobName, initialKind, areas, defaultAreaId, sitePhone, siteContact }: {
  jobId: string; jobName: string; initialKind: Kind; areas: { id: string; name: string }[]; defaultAreaId?: string;
  sitePhone: string | null; siteContact: string | null;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [category, setCategory] = useState<string>("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const safetyCritical = kind === "issue" && (category === "safety" || category === "edge_protection" || priority === "urgent");

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const files = Array.from(list).slice(0, room);
    if (list.length > room) setError(`You can attach up to ${MAX_PHOTOS} photos.`);
    const added = await Promise.all(
      files.map(async (f) => {
        const blob = await compress(f);
        return { key: `${f.name}-${f.size}-${Math.random()}`, file: blob, name: f.name.replace(/\.\w+$/, "") + ".jpg", preview: URL.createObjectURL(blob), caption: "" };
      }),
    );
    setPhotos((p) => [...p, ...added]);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    fd.set("jobId", jobId);
    fd.set("kind", kind);
    if (kind === "issue") {
      fd.set("category", category);
      fd.set("priority", priority);
    }
    fd.delete("photos");
    fd.delete("captions");
    photos.forEach((p) => {
      fd.append("photos", p.file, p.name);
      fd.append("captions", p.caption);
    });

    // Client-side checks mirror the server's; the server is authoritative.
    const errs: Record<string, string> = {};
    if (kind === "issue" && !category) errs.category = "Choose what kind of issue this is";
    if (kind === "issue" && String(fd.get("title") ?? "").trim().length < 3) errs.title = "Give the issue a short title";
    if (kind === "progress" && !String(fd.get("description") ?? "").trim()) errs.description = "Describe the progress made";
    if (kind === "photo" && photos.length === 0) errs.photos = "Add at least one photo";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setError("Check the highlighted fields.");
      return;
    }

    setBusy(true);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/reports");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(ev.loaded / ev.total);
    xhr.onload = () => {
      let body: { href?: string; error?: string; fieldErrors?: Record<string, string> } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status === 201 && body.href) {
        router.push(`${body.href}?sent=1`);
        router.refresh();
        return;
      }
      setBusy(false);
      if (xhr.status === 401) setError("Your session has expired. Sign in again in a new tab, then tap Send — your report is still here.");
      else {
        setError(body.error ?? "The report could not be sent.");
        setFieldErrors(body.fieldErrors ?? {});
      }
    };
    xhr.onerror = () => {
      setBusy(false);
      setError("No connection — your report has NOT been sent yet. Move to better signal and tap Send again. Nothing you entered has been lost.");
    };
    xhr.send(fd);
  }

  const kinds: { id: Kind; label: string; icon: typeof WarningOctagon }[] = [
    { id: "issue", label: "Issue", icon: WarningOctagon },
    { id: "progress", label: "Progress", icon: TrendUp },
    { id: "photo", label: "Photos", icon: Images },
  ];

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-6" noValidate>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-ink/[0.06] p-1" role="radiogroup" aria-label="Report type">
        {kinds.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="radio" aria-checked={kind === id} onClick={() => setKind(id)}
            className={cn("flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors",
              kind === id ? "bg-card text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink")}>
            <Icon className="size-5" weight={kind === id ? "fill" : "regular"} /> {label}
          </button>
        ))}
      </div>

      {kind === "issue" && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">What&apos;s the problem?</legend>
          <div className="grid grid-cols-2 gap-2">
            {categories.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setCategory(id)} aria-pressed={category === id}
                className={cn("flex min-h-16 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[14px] font-semibold leading-tight transition-colors",
                  category === id ? (id === "safety" || id === "edge_protection" ? "border-danger bg-danger-soft text-danger" : "border-ink bg-ink text-white") : "border-line-strong bg-card hover:border-ink/40",
                  id === "other" && "col-span-2 min-h-12")}>
                <Icon className="size-6 shrink-0" weight={category === id ? "fill" : "duotone"} />
                {label}
              </button>
            ))}
          </div>
          {fieldErrors.category && <p className="text-[13px] font-medium text-danger">{fieldErrors.category}</p>}
        </fieldset>
      )}

      {safetyCritical && (
        <div className="rounded-2xl border-2 border-danger bg-danger-soft p-4 text-[#7a1810]" role="alert">
          <p className="font-bold">Is anyone at risk right now?</p>
          <p className="mt-1 text-[14px] leading-snug">Stop work, make the area safe and <strong>phone the site manager or your supervisor now</strong>. This report does not replace speaking to someone.</p>
          {sitePhone && (
            <a href={telHref(sitePhone)} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-danger text-[16px] font-bold text-white">
              <Phone className="size-5" weight="fill" /> Call {siteContact ?? "site"} — {sitePhone}
            </a>
          )}
        </div>
      )}

      {kind === "issue" && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">How urgent?</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["normal", "high", "urgent"] as const).map((p) => (
              <button key={p} type="button" aria-pressed={priority === p} onClick={() => setPriority(p)}
                className={cn("h-12 rounded-xl border text-[15px] font-semibold capitalize transition-colors",
                  priority === p ? (p === "urgent" ? "border-danger bg-danger text-white" : p === "high" ? "border-warn bg-warn text-white" : "border-ink bg-ink text-white") : "border-line-strong bg-card")}>
                {p}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="Where?" htmlFor="areaId" hint={`On ${jobName}`}>
        <Select id="areaId" name="areaId" defaultValue={defaultAreaId ?? (areas.length === 1 ? areas[0].id : "")}>
          <option value="">Whole job / not area-specific</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>

      {kind === "issue" && (
        <Field label="Short title" htmlFor="title" error={fieldErrors.title} hint="e.g. “Barrier missing at grid C4”">
          <Input id="title" name="title" maxLength={160} autoComplete="off" aria-invalid={Boolean(fieldErrors.title)} />
        </Field>
      )}
      {kind !== "issue" && (
        <Field label="Title" htmlFor="title" optional>
          <Input id="title" name="title" maxLength={160} autoComplete="off" placeholder={kind === "progress" ? "e.g. Level 1 bays A1–D3 decked" : "e.g. Level 2 handover photos"} />
        </Field>
      )}
      <Field label={kind === "progress" ? "What's been done?" : "Details"} htmlFor="description" error={fieldErrors.description} optional={kind !== "progress"}>
        <Textarea id="description" name="description" maxLength={4000} rows={4} aria-invalid={Boolean(fieldErrors.description)}
          placeholder={kind === "issue" ? "What, where, and what you've done about it" : kind === "progress" ? "Bays completed, what's next, anything holding you up" : "Optional note"} />
      </Field>

      <div>
        <p className="mb-2 text-sm font-semibold">Photos <span className="font-normal text-subtle">{photos.length}/{MAX_PHOTOS}</span></p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white disabled:opacity-40">
            <Camera className="size-6" weight="fill" /> Take photo
          </button>
          <button type="button" onClick={() => libraryRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}
            className="flex h-14 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-[15px] font-semibold disabled:opacity-40">
            <ImageSquare className="size-6" /> From gallery
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1}
          onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={libraryRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1}
          onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        {fieldErrors.photos && <p className="mt-2 text-[13px] font-medium text-danger">{fieldErrors.photos}</p>}
        {photos.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {photos.map((p, i) => (
              <li key={p.key} className="flex items-center gap-3 rounded-xl border border-line bg-card p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview blob */}
                <img src={p.preview} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                <input
                  value={p.caption}
                  onChange={(e) => setPhotos((all) => all.map((x) => (x.key === p.key ? { ...x, caption: e.target.value } : x)))}
                  placeholder={`Caption for photo ${i + 1} (optional)`}
                  maxLength={300}
                  className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 text-[15px] focus:border-ink focus:outline-none"
                />
                <button type="button" onClick={() => { URL.revokeObjectURL(p.preview); setPhotos((all) => all.filter((x) => x.key !== p.key)); }}
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-paper hover:text-danger" aria-label={`Remove photo ${i + 1}`}>
                  <X className="size-5" weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[12px] text-muted">Photos are resized before sending and location data is removed. Your name and the time are recorded automatically.</p>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 pb-safe pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button type="submit" disabled={busy}
          className={cn("relative flex h-14 w-full items-center justify-center overflow-hidden rounded-xl text-[17px] font-bold transition-transform active:scale-[0.99] disabled:cursor-wait",
            kind === "issue" ? "bg-signal text-ink" : "bg-ink text-white")}>
          {busy && <span className="absolute inset-y-0 left-0 bg-black/15 transition-[width]" style={{ width: `${progress * 100}%` }} aria-hidden />}
          <span className="relative">{busy ? (progress < 1 ? `Sending… ${Math.round(progress * 100)}%` : "Saving…") : kind === "issue" ? "Send to MSW office" : kind === "progress" ? "Send progress update" : "Upload photos"}</span>
        </button>
      </div>
    </form>
  );
}
