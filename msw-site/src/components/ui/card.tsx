import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function SectionTitle({ children, action, className, id }: { children: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 id={id} className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-ink">
        <span className="h-3.5 w-1 rounded-sm bg-brand" aria-hidden />{children}
      </h2>
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

export function Stat({ label, value, tone, hint, href, icon }: {
  label: string; value: number | string; tone?: "danger" | "warn" | "ok"; hint?: string; href?: string; icon?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-muted">{label}</p>
        {icon && <span className={cn("grid size-8 place-items-center rounded-lg [&_svg]:size-[18px]",
          tone === "danger" ? "bg-brand-soft text-brand" : tone === "warn" ? "bg-warn-soft text-warn" : tone === "ok" ? "bg-ok-soft text-ok" : "bg-paper text-ink")}>{icon}</span>}
      </div>
      <p className={cn("tabular mt-2 text-[34px] font-bold leading-none tracking-tight", tone === "danger" && "text-brand", tone === "warn" && "text-warn", tone === "ok" && "text-ok")}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-subtle">{hint}</p>}
    </>
  );
  const cls = cn("relative block overflow-hidden rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-card)]",
    tone === "danger" && "border-l-[3px] border-l-brand", tone === "warn" && "border-l-[3px] border-l-warn");
  return href
    ? <a href={href} className={cn(cls, "transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lift)]")}>{body}</a>
    : <div className={cls}>{body}</div>;
}
