import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "cursor-pointer inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color,border-color,color,box-shadow] duration-300 ease-[var(--ease-out-soft)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0";
const variants: Record<Variant, string> = {
  primary: "bg-[linear-gradient(180deg,#e11d1e,#c00f10)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_24px_-10px_rgb(211_17_18/0.7)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_14px_30px_-10px_rgb(211_17_18/0.8)]",
  dark: "bg-[linear-gradient(180deg,#2a2e35,#0d0f12)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_10px_24px_-12px_rgb(0_0_0/0.6)]",
  secondary: "bg-card text-ink shadow-[var(--shadow-card)] ring-1 ring-line hover:ring-line-strong",
  ghost: "text-ink hover:bg-ink/5",
  danger: "border border-danger/30 bg-card text-danger hover:bg-danger-soft",
  success: "bg-ok text-white hover:bg-[#125f31]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-6 text-base",
  xl: "min-h-14 px-7 text-[17px]",
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
