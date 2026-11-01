import Link from "next/link";
import { CaretLeft, Info, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

export function ViewerBar({ backHref, backLabel, docNumber, revision, title, downloadHref, details, tone = "ok" }: {
  backHref: string; backLabel: string; docNumber: string; revision: string; title: string; downloadHref: string;
  details?: ReactNode; tone?: "ok" | "danger" | "info";
}) {
  const revTone = tone === "ok" ? "bg-ok text-white" : tone === "danger" ? "bg-danger text-white" : "bg-info text-white";
  return (
    <header className="relative z-20 bg-ink pt-[env(safe-area-inset-top)] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex h-16 items-center gap-2 px-2 sm:px-4">
        <Link href={backHref} className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label={backLabel}>
          <CaretLeft className="size-6" weight="bold" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[14px] font-semibold">{docNumber}</span>
            <span className={`shrink-0 rounded-md px-1.5 py-px font-mono text-[12px] font-bold ${revTone}`}>Rev {revision}</span>
          </div>
          <p className="truncate text-[13px] text-white/65">{title}</p>
        </div>
        {details && (
          <details className="group relative">
            <summary className="grid size-12 cursor-pointer list-none place-items-center rounded-full hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="Document details">
              <Info className="size-6" />
            </summary>
            <div className="absolute right-0 top-14 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-card p-4 text-ink shadow-[var(--shadow-lift)]">
              {details}
            </div>
          </details>
        )}
        <a href={downloadHref} className="hidden h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-semibold hover:bg-white/10 sm:inline-flex">
          <DownloadSimple className="size-5" /> Download
        </a>
      </div>
    </header>
  );
}
