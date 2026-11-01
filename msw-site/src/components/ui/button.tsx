import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-[transform,background-color,border-color,color,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0";
const variants: Record<Variant, string> = {
  primary: "bg-signal text-ink shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] hover:bg-[#ffc240]",
  dark: "bg-ink text-white hover:bg-ink-2",
  secondary: "border border-line-strong bg-card text-ink hover:border-ink/40 hover:bg-white",
  ghost: "text-ink hover:bg-ink/5",
  danger: "border border-danger/30 bg-card text-danger hover:bg-danger-soft",
  success: "bg-ok text-white hover:bg-[#125f31]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-13 px-5 text-base",
  xl: "min-h-14 px-6 text-[17px]",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "secondary", size = "md", className, ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary", size = "md", className, href, children, external, ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string; variant?: Variant; size?: Size; external?: boolean; children: ReactNode }) {
  if (external || href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("http")) {
    return (
      <a
        href={href}
        className={buttonClass(variant, size, className)}
        {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...(props as ComponentProps<"a">)}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
