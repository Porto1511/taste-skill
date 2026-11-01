import Link from "next/link";
import type { PersonRow } from "@/server/queries/office";
import { Badge } from "@/components/ui/badge";
import { labels, relativeTime } from "@/lib/format";

export function PeopleTable({ people, now, showCompany = true }: { people: PersonRow[]; now: number; showCompany?: boolean }) {
  if (!people.length) return <p className="px-4 py-8 text-center text-sm text-muted">No people found.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-[14px]">
        <thead className="border-b border-line text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
          <tr><th className="px-4 py-2.5">Name</th>{showCompany && <th className="px-3 py-2.5">Employer</th>}<th className="px-3 py-2.5">Role</th><th className="px-3 py-2.5">Current jobs</th><th className="px-4 py-2.5 text-right">Last seen</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {people.map((p) => (
            <tr key={p.id} className="relative hover:bg-paper">
              <td className="px-4 py-2.5">
                <Link href={`/office/people/${p.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">{p.full_name}</Link>
                {!p.active && <Badge tone="danger" className="ml-2">Deactivated</Badge>}
                <span className="block text-[12px] text-muted">{p.job_title ?? p.email}</span>
              </td>
              {showCompany && <td className="px-3 py-2.5 text-muted">{p.company_name}</td>}
              <td className="px-3 py-2.5"><Badge tone={p.role === "admin" ? "dark" : p.role === "office" ? "info" : p.role === "manager" ? "signal" : "neutral"}>{labels.role[p.role]}</Badge></td>
              <td className="px-3 py-2.5 font-mono text-[12px] text-muted">{p.role === "admin" || p.role === "office" ? <span className="font-sans">All jobs</span> : p.job_numbers.length ? p.job_numbers.join(", ") : <span className="font-sans text-subtle">None</span>}</td>
              <td className="px-4 py-2.5 text-right text-[13px] text-muted">{p.last_seen_at ? relativeTime(p.last_seen_at, now) : "Never"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
