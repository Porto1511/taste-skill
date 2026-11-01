"use client";

import { useLinkStatus } from "next/link";

/** Inline spinner shown inside a <Link> while its navigation is pending. */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className={`inline-block size-4 shrink-0 rounded-full border-2 border-current border-r-transparent transition-opacity ${pending ? "animate-spin opacity-60" : "opacity-0"} ${className}`} />
  );
}
