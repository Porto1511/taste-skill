"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { MagnifyingGlassMinus, MagnifyingGlassPlus, ArrowsIn, DownloadSimple, ArrowClockwise } from "@phosphor-icons/react";

/*
  High-quality PDF viewing for phones and desktops.
  - Pinch/scroll zoom and pan via react-zoom-pan-pinch.
  - Each page has a base canvas rendered within a pixel budget (safe for
    mobile Safari's canvas limits).
  - When zoomed past the base resolution, a "detail tile" covering only the
    visible region is rendered at full device resolution once the gesture
    settles, so fine print on A1/A3 drawings stays crisp at high zoom.
*/

type PageInfo = { width: number; height: number };
type View = { scale: number; x: number; y: number };

const PAD = 12;
const GAP = 14;
const MAX_BASE_PIXELS = 10_000_000;
const MAX_TILE_PIXELS = 12_000_000;
const MAX_SCALE = 16;

export function PdfViewer({ src, downloadHref, label }: { src: string; downloadHref: string; label: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const controls = useRef<ReactZoomPanPinchContentRef | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [liveScale, setLiveScale] = useState(1);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((prev) => (prev && Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      task = pdfjs.getDocument({ url: src, withCredentials: true, disableRange: true });
      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (total) setProgress(Math.min(1, loaded / total));
      };
      const d = await task.promise;
      if (cancelled) return;
      const info: PageInfo[] = [];
      for (let i = 1; i <= d.numPages; i++) {
        const vp = (await d.getPage(i)).getViewport({ scale: 1 });
        info.push({ width: vp.width, height: vp.height });
      }
      if (cancelled) return;
      setPages(info);
      setDoc(d);
      setStatus("ready");
    })().catch((err: { status?: number; name?: string }) => {
      if (cancelled) return;
      setStatus("error");
      setErrorText(
        err?.status === 404
          ? "This document is no longer available to you. It may have been superseded or your access changed."
          : "The document could not be loaded. Check your signal and try again.",
      );
    });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [src, attempt]);

  const layout = useMemo(() => {
    if (!box || pages.length === 0) return null;
    const availW = Math.max(100, box.w - PAD * 2);
    const availH = Math.max(100, box.h - PAD * 2);
    const maxW = Math.max(...pages.map((p) => p.width));
    const fit = pages.length === 1 ? Math.min(availW / pages[0].width, availH / pages[0].height) : availW / maxW;
    const contentW = Math.max(box.w, maxW * fit + PAD * 2);
    const heights = pages.map((p) => p.height * fit);
    const rects = pages.map((p, i) => {
      const w = p.width * fit;
      const top = PAD + heights.slice(0, i).reduce((sum, h) => sum + h + GAP, 0);
      return { w, h: heights[i], top, left: (contentW - w) / 2 };
    });
    const contentH = Math.max(box.h, PAD * 2 + heights.reduce((s, h) => s + h, 0) + GAP * (pages.length - 1));
    // A single sheet is centred in the viewport (e.g. landscape drawing on a portrait phone).
    if (rects.length === 1) rects[0].top = Math.max(PAD, (contentH - rects[0].h) / 2);
    return { fit, rects, contentW, contentH };
  }, [box, pages]);

  const onTransform = useCallback((_: unknown, s: { scale: number; positionX: number; positionY: number }) => {
    setLiveScale(s.scale);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setView({ scale: s.scale, x: s.positionX, y: s.positionY }), 180);
  }, []);

  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 3);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#2a2823]">
      <div ref={wrapperRef} className="relative min-h-0 flex-1 touch-none overflow-hidden" aria-label={`${label} — pinch or scroll to zoom, drag to pan`}>
        {status === "loading" && <LoadingSheet progress={progress} />}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div className="max-w-sm">
              <p className="text-lg font-semibold">Couldn&apos;t open this document</p>
              <p className="mt-2 text-white/70">{errorText}</p>
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" onClick={() => { setStatus("loading"); setProgress(0); setAttempt((a) => a + 1); }} className="inline-flex h-12 items-center gap-2 rounded-xl bg-signal px-5 font-semibold text-ink">
                  <ArrowClockwise className="size-5" weight="bold" /> Try again
                </button>
              </div>
            </div>
          </div>
        )}
        {status === "ready" && doc && layout && box && (
          <TransformWrapper
            key={`${box.w}x${box.h}`}
            ref={controls}
            minScale={1}
            maxScale={MAX_SCALE}
            initialScale={1}
            limitToBounds
            centerOnInit
            centerZoomedOut
            smooth
            wheel={{ step: 0.18 }}
            pinch={{ step: 6 }}
            doubleClick={{ mode: "toggle", step: 1.4, animationTime: 220 }}
            keyboard={{ disabled: false }}
            onTransform={onTransform}
          >
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: layout.contentW, height: layout.contentH }}>
              <div style={{ position: "relative", width: layout.contentW, height: layout.contentH }}>
                {layout.rects.map((r, i) => (
                  <PdfPage
                    key={i}
                    doc={doc}
                    index={i}
                    rect={r}
                    fit={layout.fit}
                    dpr={dpr}
                    view={view}
                    box={box}
                  />
                ))}
              </div>
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>

      {status === "ready" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-ink/90 p-1.5 text-white shadow-[var(--shadow-lift)] backdrop-blur">
            <ToolButton label="Zoom out" onClick={() => controls.current?.zoomOut(0.5, 180)}><MagnifyingGlassMinus className="size-6" /></ToolButton>
            <span className="tabular w-16 text-center text-sm font-semibold" aria-live="polite">{Math.round(liveScale * 100)}%</span>
            <ToolButton label="Zoom in" onClick={() => controls.current?.zoomIn(0.5, 180)}><MagnifyingGlassPlus className="size-6" /></ToolButton>
            <span className="mx-1 h-7 w-px bg-white/15" />
            <ToolButton label="Fit to screen" onClick={() => controls.current?.resetTransform(200)}><ArrowsIn className="size-6" /></ToolButton>
            <a href={downloadHref} className="grid size-12 place-items-center rounded-xl hover:bg-white/10" aria-label="Download PDF">
              <DownloadSimple className="size-6" />
            </a>
            {pages.length > 1 && <span className="px-2 text-[13px] text-white/60">{pages.length} pages</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid size-12 place-items-center rounded-xl transition-colors hover:bg-white/10 active:bg-white/15">
      {children}
    </button>
  );
}

function LoadingSheet({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-8" role="status">
      <div className="w-full max-w-md">
        <div className="skeleton aspect-[1.414] w-full opacity-20" />
        <div className="mx-auto mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-signal transition-[width] duration-200" style={{ width: `${Math.max(8, progress * 100)}%` }} />
        </div>
        <p className="mt-3 text-center text-sm text-white/60">Loading drawing…</p>
      </div>
    </div>
  );
}

function PdfPage({ doc, index, rect, fit, dpr, view, box }: {
  doc: PDFDocumentProxy; index: number; rect: { w: number; h: number; top: number; left: number };
  fit: number; dpr: number; view: View; box: { w: number; h: number };
}) {
  const holder = useRef<HTMLDivElement>(null);
  const baseCanvas = useRef<HTMLCanvasElement>(null);
  const tileHolder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(index < 2);
  const [baseDensity, setBaseDensity] = useState(0);
  const tileTask = useRef<RenderTask | null>(null);

  // Render pages lazily as they approach the viewport.
  useEffect(() => {
    const el = holder.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  // Base render
  useEffect(() => {
    if (!visible) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(index + 1);
      if (cancelled) return;
      const density = Math.min(dpr * 2.5, Math.sqrt(MAX_BASE_PIXELS / (rect.w * rect.h)));
      const viewport = page.getViewport({ scale: fit * density });
      const canvas = baseCanvas.current!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport });
      await task.promise;
      if (!cancelled) setBaseDensity(density);
    })().catch(() => {});
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, index, fit, rect.w, rect.h, dpr, visible]);

  // Detail tile for the visible region when zoomed beyond the base resolution.
  useEffect(() => {
    const target = tileHolder.current;
    if (!target || !baseDensity) return;
    const needed = view.scale * dpr;
    if (needed <= baseDensity * 1.15) {
      target.replaceChildren();
      return;
    }
    const vx = -view.x / view.scale;
    const vy = -view.y / view.scale;
    const vw = box.w / view.scale;
    const vh = box.h / view.scale;
    const x1 = Math.max(0, vx - rect.left);
    const y1 = Math.max(0, vy - rect.top);
    const x2 = Math.min(rect.w, vx + vw - rect.left);
    const y2 = Math.min(rect.h, vy + vh - rect.top);
    if (x2 <= x1 || y2 <= y1) return;
    const density = Math.min(needed, Math.sqrt(MAX_TILE_PIXELS / ((x2 - x1) * (y2 - y1))));
    let cancelled = false;
    tileTask.current?.cancel();
    (async () => {
      const page = await doc.getPage(index + 1);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: fit * density });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil((x2 - x1) * density);
      canvas.height = Math.ceil((y2 - y1) * density);
      Object.assign(canvas.style, {
        position: "absolute", left: `${x1}px`, top: `${y1}px`, width: `${x2 - x1}px`, height: `${y2 - y1}px`,
      });
      const task = page.render({
        canvas, canvasContext: canvas.getContext("2d")!, viewport,
        transform: [1, 0, 0, 1, -x1 * density, -y1 * density],
      });
      tileTask.current = task;
      await task.promise;
      if (!cancelled) target.replaceChildren(canvas);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [view, baseDensity, doc, index, fit, dpr, rect, box]);

  return (
    <div
      ref={holder}
      className="absolute bg-white shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
      style={{ left: rect.left, top: rect.top, width: rect.w, height: rect.h }}
      data-page={index + 1}
    >
      <canvas ref={baseCanvas} className="absolute inset-0 size-full" aria-hidden />
      <div ref={tileHolder} className="absolute inset-0" aria-hidden />
    </div>
  );
}
