import { cn } from "@/lib/cn";

/** MSW Site mark: a trapezoidal metal-deck profile on a hi-vis tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect width="40" height="40" rx="9" fill="#FFB81C" />
      <path d="M5 26h5l3-9h5l3 9h4l3-9h5l2 6" fill="none" stroke="#17150F" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M5 31h30" stroke="#17150F" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, tone = "light", sub }: { className?: string; tone?: "light" | "dark"; sub?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className={cn("block text-[17px] font-bold tracking-tight", tone === "light" ? "text-white" : "text-ink")}>
          MSW <span className="font-medium opacity-70">Site</span>
        </span>
        {sub && <span className={cn("mt-1 block text-[11px] font-medium uppercase tracking-[0.12em]", tone === "light" ? "text-white/55" : "text-muted")}>{sub}</span>}
      </span>
    </span>
  );
}
