import { config } from "@/server/config";
import { BUILT_BY } from "@/lib/company";
import { requestNow } from "@/lib/now";

// Shown only on the demo, for the big reveal. The data is still made up, so it says so.
const LINES = [
  `Built in-house by ${BUILT_BY} — between site visits, brews and arguing with the printer`,
  `Hand-made by ${BUILT_BY}. No, it won't fill your timesheet in for you`,
  `Another ${BUILT_BY} production · zero paper sheets were lost in the making of this app`,
  `Designed by ${BUILT_BY} · approved by nobody · works anyway`,
  `${BUILT_BY} built this. Please direct all complaints to the hoist`,
];

export function DemoStrip() {
  if (!config.isDemo) return null;
  const line = LINES[Math.floor(requestNow() / 864e5) % LINES.length]; // a new one each day
  return (
    <aside aria-label="About this demo" className="flex items-center justify-center gap-2 border-b border-line bg-card px-4 py-1.5 text-center text-[12px] text-muted">
      <span className="hidden rounded bg-ink px-1.5 py-px text-[12px] font-bold uppercase tracking-wider text-white sm:inline">Demo</span>
      <span><span className="font-semibold text-ink">{line}</span> · practice data, names made up</span>
    </aside>
  );
}
