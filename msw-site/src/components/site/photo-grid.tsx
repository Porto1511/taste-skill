"use client";

import { useEffect, useState } from "react";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react";

export interface GridPhoto { id: string; caption: string | null; meta?: string }

export function PhotoGrid({ photos, columns = 3, base = "/api/files/photos" }: { photos: GridPhoto[]; columns?: 2 | 3 | 4; base?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : Math.min(photos.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, photos.length]);

  const cols = columns === 2 ? "grid-cols-2" : columns === 4 ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-3";
  const current = open !== null ? photos[open] : null;
  return (
    <>
      <div className={`grid ${cols} gap-1.5`}>
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative aspect-square overflow-hidden rounded-xl bg-line"
            aria-label={`Open photo${p.caption ? `: ${p.caption}` : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised, uncacheable API image */}
            <img src={`${base}/${p.id}?thumb=1`} alt={p.caption ?? "Site photo"} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          </button>
        ))}
      </div>
      {current && (
        <div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
          <div className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="tabular px-2 text-sm text-white/70">{open! + 1} / {photos.length}</span>
            <button type="button" onClick={() => setOpen(null)} className="grid size-12 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
              <X className="size-7" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}/${current.id}`} alt={current.caption ?? "Site photo"} className="max-h-full max-w-full object-contain" />
            {open! > 0 && (
              <button type="button" onClick={() => setOpen(open! - 1)} className="absolute left-2 grid size-12 place-items-center rounded-full bg-black/50 hover:bg-black/70" aria-label="Previous photo">
                <CaretLeft className="size-6" weight="bold" />
              </button>
            )}
            {open! < photos.length - 1 && (
              <button type="button" onClick={() => setOpen(open! + 1)} className="absolute right-2 grid size-12 place-items-center rounded-full bg-black/50 hover:bg-black/70" aria-label="Next photo">
                <CaretRight className="size-6" weight="bold" />
              </button>
            )}
          </div>
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {current.caption && <p className="font-medium">{current.caption}</p>}
            {current.meta && <p className="text-sm text-white/60">{current.meta}</p>}
          </div>
        </div>
      )}
    </>
  );
}
