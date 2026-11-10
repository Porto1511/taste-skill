import { config } from "@/server/config";
import { BUILT_BY } from "@/lib/company";
import { requestNow } from "@/lib/now";

// Shown only on the hosted showcase build, for the big reveal.
const LINES = [
  `Built in-house between site visits, brews and arguing with the printer`,
  `No, it won't fill your timesheet in for you`,
  `Zero paper sheets were lost in the making of this app`,
  `Approved by nobody · works anyway`,
  `Please direct all complaints to the hoist`,
];

export function DemoStrip() {
  if (!config.isDemo) return null;
  const line = LINES[Math.floor(requestNow() / 864e5) % LINES.length]; // a new one each day
  return (
    <aside aria-label="Credits" className="mx-auto mt-3 flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full bg-card px-1.5 py-1 pr-4 text-[12px] text-muted shadow-[var(--shadow-card)] ring-1 ring-line">
      <span className="shrink-0 rounded-full bg-[linear-gradient(180deg,#e11d1e,#b30e10)] px-2.5 py-0.5 text-[12px] font-semibold text-white">Made by {BUILT_BY}</span>
      <span className="line-clamp-2 font-semibold text-ink">{line}</span>
    </aside>
  );
}
