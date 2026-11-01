import Link from "next/link";
import type { JobSummary } from "@/server/queries/office";
import { Badge, JobStatusBadge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format";

export function JobsTable({ jobs, now }: { jobs: JobSummary[]; now: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[14px]">
        <thead className="border-b border-line text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
          <tr>
            <th className="px-4 py-2.5">Job</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Contracts manager</th>
            <th className="px-3 py-2.5 text-right">People</th>
            <th className="px-3 py-2.5 text-right">Open issues</th>
            <th className="px-3 py-2.5 text-right">Drafts</th>
            <th className="px-4 py-2.5 text-right">Last activity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {jobs.map((j) => (
            <tr key={j.id} className="group relative transition-colors hover:bg-paper">
              <td className="px-4 py-3">
                <Link href={`/office/jobs/${j.id}`} className="after:absolute after:inset-0">
                  <span className="font-mono text-[12px] font-semibold text-muted">{j.job_number}</span>
                  <span className="block font-semibold group-hover:underline">{j.name}</span>
                  <span className="block text-[12px] text-muted">{j.main_contractor ?? "—"}{j.postcode ? ` · ${j.postcode}` : ""}</span>
                </Link>
              </td>
              <td className="px-3 py-3"><JobStatusBadge status={j.status} /></td>
              <td className="px-3 py-3 text-muted">{j.contracts_manager_name ?? "—"}</td>
              <td className="tabular px-3 py-3 text-right">{j.people}<span className="text-muted"> / {j.companies} co.</span></td>
              <td className="px-3 py-3 text-right">
                {j.urgent_issues > 0 ? <Badge tone="danger">{j.open_issues} · {j.urgent_issues} urgent</Badge> : j.open_issues > 0 ? <Badge tone="warn">{j.open_issues}</Badge> : <span className="text-subtle">0</span>}
              </td>
              <td className="px-3 py-3 text-right">{j.drafts > 0 ? <Badge tone="info">{j.drafts}</Badge> : <span className="text-subtle">0</span>}</td>
              <td className="px-4 py-3 text-right text-[13px] text-muted">{j.last_activity_at ? relativeTime(j.last_activity_at, now) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
