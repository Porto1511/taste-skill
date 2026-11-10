import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)] ring-1 ring-line", className)} {...props} />;
}

export function SectionTitle({ children, action, className, id }: { children: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 id={id} className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-[var(--radius-card)] bg-card/60 px-6 py-10 text-center ring-1 ring-line", className)}>
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
        {icon && <span className={cn("grid size-9 place-items-center rounded-full [&_svg]:size-[18px]",
          tone === "danger" ? "bg-brand-soft text-brand" : tone === "warn" ? "bg-warn-soft text-warn" : tone === "ok" ? "bg-ok-soft text-ok" : "bg-paper text-ink")}>{icon}</span>}
      </div>
      <p className={cn("tabular mt-3 text-[36px] font-semibold leading-none tracking-[-0.03em]", tone === "danger" && "text-brand", tone === "warn" && "text-warn", tone === "ok" && "text-ok")}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-subtle">{hint}</p>}
    </>
  );
  const cls = "relative block overflow-hidden rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] ring-1 ring-line";
  return href
    ? <a href={href} className={cn(cls, "transition-[box-shadow,transform] duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]")}>{body}</a>
    : <div className={cls}>{body}</div>;
}
