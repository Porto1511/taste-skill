"use client";

import { useActionState } from "react";
import { giveJobToCompanyAction, takeJobFromCompanyAction } from "@/server/actions/access";
import type { JobCompanyRow } from "@/server/queries/office";
import { idle } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { Select } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";
import { Card, SectionTitle } from "@/components/ui/card";

/** Which subcontractors have this job.  Their boss picks which of their people see it. */
export function JobCompanies({ jobId, holding, others, canEdit }: { jobId: string; holding: JobCompanyRow[]; others: { id: string; name: string }[]; canEdit: boolean }) {
  const [give, giveAction] = useActionState(giveJobToCompanyAction, idle);
  return (
    <section className="mb-8">
      <SectionTitle>Subcontractors on this job</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        {holding.length === 0 && <p className="px-5 py-4 text-[14px] text-muted">No subcontractor has this job yet.</p>}
        {holding.map((h) => <Holding key={h.id} row={h} canEdit={canEdit} />)}
        {canEdit && others.length > 0 && (
          <form action={giveAction} className="grid gap-2 bg-paper px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <input type="hidden" name="jobId" value={jobId} />
            <Select name="companyId" aria-label="Company to give the job to" defaultValue="">
              <option value="" disabled>Give this job to…</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
            <SubmitButton variant="dark" size="md" pendingText="Giving…">Give job</SubmitButton>
            <div className="sm:col-span-2"><FormMessage state={give} /></div>
          </form>
        )}
      </Card>
      <p className="mt-2 px-1 text-[13px] text-muted">Their boss sees the whole job and ticks which of their lads can see it. Take it off and none of them can.</p>
    </section>
  );
}

function Holding({ row, canEdit }: { row: JobCompanyRow; canEdit: boolean }) {
  const [state, action] = useActionState(takeJobFromCompanyAction, idle);
  return (
    <div role="group" aria-label={row.name} className="flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{row.name}</p>
        <p className="text-[13px] text-muted">
          Boss: {row.boss_names ?? "none set up"} · {row.people_on} of their people ticked · given {formatDate(row.granted_at)}{row.granted_by_name ? ` by ${row.granted_by_name}` : ""}
        </p>
      </div>
      {canEdit && (
        <form action={action} onSubmit={(e) => { if (!confirm(`Take this job off ${row.name}? None of their people will see it.`)) e.preventDefault(); }}>
          <input type="hidden" name="jobCompanyId" value={row.id} />
          <SubmitButton variant="danger" size="sm" pendingText="Taking off…">Take off job</SubmitButton>
        </form>
      )}
      {state.error && <p className="w-full text-[13px] text-danger" role="alert">{state.error}</p>}
    </div>
  );
}
