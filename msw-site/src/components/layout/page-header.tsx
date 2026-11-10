import Link from "next/link";
import type { ReactNode } from "react";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

export function PageHeader({ title, eyebrow, description, actions, back }: {
  title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="-ml-1 mb-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 py-1 text-sm font-medium text-muted hover:text-ink">
          <CaretLeft className="size-4" weight="bold" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 text-[13px] font-semibold text-muted">{eyebrow}</div>}
          <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
          {description && <div className="mt-1.5 max-w-[70ch] text-muted">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
