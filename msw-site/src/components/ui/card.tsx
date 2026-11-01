import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function SectionTitle({ children, action, className, id }: { children: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 id={id} className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-card/60 px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-full bg-ink/[0.05] text-muted [&_svg]:size-6">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, tone, hint, href }: { label: string; value: number | string; tone?: "danger" | "warn" | "ok"; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={cn("tabular mt-1 text-3xl font-semibold tracking-tight", tone === "danger" && "text-danger", tone === "warn" && "text-warn", tone === "ok" && "text-ok")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
    </>
  );
  const cls = "block rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-card)]";
  return href ? <a href={href} className={cn(cls, "transition-colors hover:border-ink/30")}>{body}</a> : <div className={cls}>{body}</div>;
}
