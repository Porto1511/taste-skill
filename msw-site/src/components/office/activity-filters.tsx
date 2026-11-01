import { cn } from "@/lib/cn";

const scopes = [
  { id: "", label: "Everything" }, { id: "access", label: "Access changes" }, { id: "documents", label: "Documents" },
  { id: "reports", label: "Reports" }, { id: "jobs", label: "Job details" }, { id: "people", label: "People" },
];

export function ActivityFilters({ base, scope }: { base: string; scope: string }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-ink/[0.05] p-1" aria-label="Filter activity">
      {scopes.map((s) => (
        <a key={s.id} href={`${base}${s.id ? `?scope=${s.id}` : ""}`}
          className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold", scope === s.id ? "bg-card shadow-[var(--shadow-card)]" : "text-muted hover:text-ink")}>
          {s.label}
        </a>
      ))}
    </nav>
  );
}
