import { config } from "@/server/config";

export function DemoStrip() {
  if (!config.isDemo) return null;
  return (
    <div className="border-b border-signal/30 bg-signal-soft px-4 py-1.5 text-center text-[12px] font-medium text-signal-ink">
      Demonstration mode — fictional data stored locally. Email invites and push notifications are simulated.
    </div>
  );
}
