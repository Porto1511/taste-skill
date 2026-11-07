import { cn } from "@/lib/cn";
import { COMPANY, MSW_LOGO_PATHS, MSW_LOGO_VIEWBOX } from "@/lib/company";

/** MSW wordmark (vector, from the company logo). */
export function MswLogo({ className, color = COMPANY.red }: { className?: string; color?: string }) {
  const v = MSW_LOGO_VIEWBOX;
  return (
    <svg viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} className={cn("h-7 w-auto", className)} role="img" aria-label="MSW">
      {MSW_LOGO_PATHS.map((d) => <path key={d} d={d} fill={color} />)}
    </svg>
  );
}

/** Square app mark: the wordmark on a white tile (used where a compact icon is needed). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-grid size-9 place-items-center rounded-lg bg-white px-1", className)} aria-hidden>
      <MswLogo className="h-auto w-full" />
    </span>
  );
}

export function Logo({ className, tone = "light", sub }: { className?: string; tone?: "light" | "dark"; sub?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("inline-flex items-center rounded-md px-2 py-1.5", tone === "light" ? "bg-white" : "")}>
        <MswLogo className="h-6" />
      </span>
      <span className="leading-none">
        <span className={cn("block text-[17px] font-semibold tracking-tight", tone === "light" ? "text-white" : "text-ink")}>Site</span>
        {sub && <span className={cn("mt-1 block text-[11px] font-medium uppercase tracking-[0.12em]", tone === "light" ? "text-white/55" : "text-muted")}>{sub}</span>}
      </span>
    </span>
  );
}
