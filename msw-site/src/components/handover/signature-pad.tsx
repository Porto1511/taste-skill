"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";

export interface SignaturePadHandle {
  toBlob(): Promise<Blob | null>;
  isEmpty(): boolean;
  clear(): void;
}

/** Finger/stylus/mouse signature capture on a transparent canvas. */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (hasInk: boolean) => void }>(function SignaturePad({ onChange }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvas.current!;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const { width, height } = c.getBoundingClientRect();
      c.width = Math.round(width * ratio);
      c.height = Math.round(height * ratio);
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#101828";
      ctx.lineWidth = 2.6;
      setHasInk(false);
      onChange?.(false);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [onChange]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasInk,
    clear: () => {
      const c = canvas.current!;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      setHasInk(false);
      onChange?.(false);
    },
    toBlob: () => new Promise((resolve) => canvas.current!.toBlob(resolve, "image/png")),
  }), [hasInk, onChange]);

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        aria-label="Signature box — sign with your finger"
        className="h-48 w-full touch-none rounded-2xl border-2 border-dashed border-ink/30 bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = point(e);
          const ctx = canvas.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = "#101828";
          ctx.fill();
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const p = point(e);
          const ctx = canvas.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
          ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
          if (!hasInk) { setHasInk(true); onChange?.(true); }
        }}
        onPointerUp={() => { drawing.current = false; last.current = null; }}
        onPointerCancel={() => { drawing.current = false; last.current = null; }}
      />
      {!hasInk && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[15px] font-medium text-subtle">Sign here</span>}
      <span className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-ink/15" aria-hidden />
      {hasInk && (
        <button type="button" onClick={() => {
          const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHasInk(false); onChange?.(false);
        }} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-paper px-2.5 py-1.5 text-[13px] font-semibold">
          <ArrowCounterClockwise className="size-4" /> Clear
        </button>
      )}
    </div>
  );
});
