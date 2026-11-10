import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "block w-full rounded-lg border border-line-strong bg-white px-3.5 py-3 text-[16px] text-ink placeholder:text-subtle shadow-[inset_0_1px_2px_rgba(23,21,15,0.04)] transition-colors focus:border-ink focus:outline-none focus:ring-3 focus:ring-brand/20 disabled:bg-paper disabled:text-muted aria-invalid:border-danger";

export function Field({
  label, htmlFor, hint, error, children, className, optional,
}: { label: string; htmlFor?: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string; optional?: boolean }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-subtle">optional</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-muted">{hint}</p>}
      {error && <p className="text-[13px] font-medium text-danger" role="alert">{error}</p>}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "min-h-28 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        inputClass,
        "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b655b'%3E%3Cpath d='M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z'/%3E%3C/svg%3E\")] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, description, className, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl px-1 py-1.5", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md accent-ink" {...props} />
      <span className="grid gap-0.5">
        <span className="text-[15px] font-medium leading-tight">{label}</span>
        {description && <span className="text-[13px] text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Alert({ tone = "danger", children, className, title }: { tone?: "danger" | "ok" | "warn" | "info"; children: ReactNode; className?: string; title?: string }) {
  const tones = {
    danger: "border-danger/25 bg-danger-soft text-[#7a1810]",
    ok: "border-ok/25 bg-ok-soft text-[#0d4a26]",
    warn: "border-warn/25 bg-warn-soft text-[#6b3300]",
    info: "border-info/20 bg-info-soft text-[#123f8f]",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  );
}
