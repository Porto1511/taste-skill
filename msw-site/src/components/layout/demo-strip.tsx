import { config } from "@/server/config";

export function DemoStrip() {
  if (!config.isDemo) return null;
  return (
    <div className="bg-signal px-4 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
      Demo · fictional data
    </div>
  );
}
