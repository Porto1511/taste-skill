"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface JobTab { id: string; label: string; count?: number; content: ReactNode }

/** Sticky segmented tabs; the open tab is kept in the URL hash. */
export function JobTabs({ tabs }: { tabs: JobTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (fromHash && tabs.some((t) => t.id === fromHash)) setActive(fromHash); // eslint-disable-line react-hooks/set-state-in-effect
  }, [tabs]);
  const select = (id: string) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <div>
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 bg-paper/95 px-4 py-2 backdrop-blur">
        <div role="tablist" className="grid grid-flow-col auto-cols-fr gap-0.5 rounded-xl bg-ink/[0.06] p-1">
          {tabs.map((t) => (
            <button key={t.id} role="tab" type="button" aria-selected={active === t.id} onClick={() => select(t.id)}
              className={cn("flex h-10 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-1 text-[13.5px] font-semibold transition-colors",
                active === t.id ? "bg-card text-ink shadow-[var(--shadow-card)]" : "text-muted")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} className="pt-3">{t.content}</div>
      ))}
    </div>
  );
}
