"use client";

import { useActionState, useMemo, useState } from "react";
import { UsersThree, PencilSimple, Lock, CheckSquare, Square } from "@phosphor-icons/react";
import { grantAccessAction, revokeAccessAction } from "@/server/actions/access";
import { idle, type ActionState } from "@/lib/action-state";
import type { AccessAssignment, AccessCompany } from "@/server/queries/office";
import { Card, SectionTitle } from "@/components/ui/card";
import { Alert, Checkbox, Field, Input } from "@/components/ui/form";
import { SubmitButton, FormMessage } from "@/components/ui/form-client";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { dateRange, labels } from "@/lib/format";
import { cn } from "@/lib/cn";

type Area = { id: string; name: string; kind: string };

export function AccessManager({ jobId, areas, assignments, companies, canEdit }: {
  jobId: string; areas: Area[]; assignments: AccessAssignment[]; companies: AccessCompany[]; canEdit: boolean;
}) {
  const withPeople = companies.filter((c) => c.people.length > 0);
  const [companyId, setCompanyId] = useState(withPeople.find((c) => !c.is_msw)?.id ?? withPeople[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<"all" | "areas">("areas");
  const [areaIds, setAreaIds] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [managerReports, setManagerReports] = useState(false);
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await grantAccessAction(prev, form);
    if (result.ok) {
      setSelected(new Set());
      setNote("");
    }
    return result;
  }, idle);

  const byUser = useMemo(() => new Map(assignments.map((a) => [a.user_id, a])), [assignments]);
  const company = withPeople.find((c) => c.id === companyId);
  const selectedPeople = company?.people.filter((p) => selected.has(p.id)) ?? [];
  const anyManager = selectedPeople.some((p) => p.role === "manager");

  function toggle(set: Set<string>, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function edit(a: AccessAssignment) {
    setCompanyId(a.company_id);
    setSelected(new Set([a.user_id]));
    setScope(a.all_areas ? "all" : "areas");
    setAreaIds(new Set(a.area_ids));
    setFrom(a.attendance_from ?? "");
    setTo(a.attendance_to ?? "");
    setNote(a.note ?? "");
    setManagerReports(a.can_view_company_reports);
    document.getElementById("grant-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const grouped = useMemo(() => {
    const m = new Map<string, AccessAssignment[]>();
    for (const a of assignments) m.set(a.company_name, [...(m.get(a.company_name) ?? []), a]);
    return [...m.entries()];
  }, [assignments]);

  const allSelected = company ? company.people.length > 0 && company.people.every((p) => selected.has(p.id)) : false;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Grant panel */}
      <section id="grant-form" className="scroll-mt-6">
        <SectionTitle>Give access</SectionTitle>
        {!canEdit ? (
          <Alert tone="info" title="View only">Only MSW administrators can change who has access to a job.</Alert>
        ) : (
          <Card className="p-5">
            <form action={action} className="grid gap-5">
              <input type="hidden" name="jobId" value={jobId} />
              {[...selected].map((id) => <input key={id} type="hidden" name="userIds" value={id} />)}
              <input type="hidden" name="scope" value={scope} />
              {scope === "areas" && [...areaIds].map((id) => <input key={id} type="hidden" name="areaIds" value={id} />)}
              {areas.length === 0 && <input type="hidden" name="allowNoAreas" value="1" />}
              {managerReports && anyManager && <input type="hidden" name="managerReports" value="1" />}

              <div>
                <p className="mb-2 text-sm font-semibold">1. Company</p>
                <div className="flex flex-wrap gap-1.5">
                  {withPeople.map((c) => (
                    <button key={c.id} type="button" onClick={() => { setCompanyId(c.id); setSelected(new Set()); }}
                      aria-pressed={c.id === companyId}
                      className={cn("rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                        c.id === companyId ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:border-ink/40")}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {company && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">2. Tick the people</p>
                    <button type="button" onClick={() => setSelected(allSelected ? new Set() : new Set(company.people.map((p) => p.id)))}
                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-signal-ink hover:underline">
                      {allSelected ? <CheckSquare className="size-4" weight="fill" /> : <Square className="size-4" />} {allSelected ? "Clear" : "Select all"}
                    </button>
                  </div>
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {company.people.map((p) => {
                      const existing = byUser.get(p.id);
                      return (
                        <li key={p.id} className="px-3">
                          <Checkbox
                            checked={selected.has(p.id)}
                            onChange={() => setSelected((s) => toggle(s, p.id))}
                            label={<span>{p.full_name}{p.role === "manager" && <Badge tone="info" className="ml-2">Manager</Badge>}</span>}
                            description={existing
                              ? <span className="font-medium text-ok">On this job · {existing.all_areas ? "All areas" : existing.area_names.join(", ") || "Job-wide only"}</span>
                              : p.job_title ?? labels.role[p.role]}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-1.5 text-[12px] text-muted">Belonging to a company never gives access on its own — only the people you tick.</p>
                </div>
              )}

              <fieldset>
                <legend className="mb-2 text-sm font-semibold">3. Where can they work?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["areas", "all"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setScope(s)} aria-pressed={scope === s}
                      className={cn("h-11 rounded-xl border text-[14px] font-semibold", scope === s ? "border-ink bg-ink text-white" : "border-line-strong bg-card")}>
                      {s === "areas" ? "Selected floors / phases" : "All areas"}
                    </button>
                  ))}
                </div>
                {scope === "areas" && (
                  areas.length ? (
                    <div className="mt-2 grid grid-cols-2 gap-x-3 rounded-xl border border-line px-3 py-1 sm:grid-cols-3">
                      {areas.map((a) => (
                        <Checkbox key={a.id} checked={areaIds.has(a.id)} onChange={() => setAreaIds((s) => toggle(s, a.id))} label={a.name} />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] text-muted">This job has no floors or phases yet — access will cover job-wide information only. Add areas on the Overview tab.</p>
                  )
                )}
                {state.fieldErrors?.areaIds && <p className="mt-1 text-[13px] font-medium text-danger">{state.fieldErrors.areaIds}</p>}
                <p className="mt-1.5 text-[12px] text-muted">They will see whole-job documents plus documents for these areas only.</p>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Attendance from" htmlFor="attendanceFrom" optional><Input id="attendanceFrom" name="attendanceFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
                <Field label="Attendance to" htmlFor="attendanceTo" optional error={state.fieldErrors?.attendanceTo}><Input id="attendanceTo" name="attendanceTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
              </div>
              <Field label="Note shown to them" htmlFor="note" optional hint="e.g. Gang A — Levels 1 & 2">
                <Input id="note" name="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
              </Field>
              {anyManager && (
                <Checkbox checked={managerReports} onChange={(e) => setManagerReports(e.target.checked)}
                  label="Let selected managers see their own company's site reports on this job"
                  description="Off by default. Managers never see other companies' reports or other jobs." />
              )}

              <FormMessage state={state} />
              <SubmitButton disabled={selected.size === 0} pendingText="Saving access…">
                <UsersThree className="size-5" weight="bold" />
                {selected.size === 0 ? "Tick people to give access" : `Give access to ${selected.size} ${selected.size === 1 ? "person" : "people"}`}
              </SubmitButton>
              {selectedPeople.some((p) => byUser.has(p.id)) && (
                <p className="-mt-2 text-[12px] text-muted">People already on this job will have their allocation replaced with these settings.</p>
              )}
            </form>
          </Card>
        )}
      </section>

      {/* Current access */}
      <section>
        <SectionTitle action={<span className="text-sm text-muted">{assignments.length} people</span>}>Who has access now</SectionTitle>
        {assignments.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted"><Lock className="mx-auto mb-2 size-6" /> Nobody outside the MSW office can see this job yet.</Card>
        ) : (
          <div className="grid gap-3">
            {grouped.map(([name, list]) => <CompanyGroup key={name} name={name} list={list} canEdit={canEdit} onEdit={edit} />)}
          </div>
        )}
        <p className="mt-2 text-[12px] text-muted">MSW office users see all jobs and are not listed. Every change is recorded in the job&apos;s activity history.</p>
      </section>
    </div>
  );
}

function CompanyGroup({ name, list, canEdit, onEdit }: { name: string; list: AccessAssignment[]; canEdit: boolean; onEdit: (a: AccessAssignment) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await revokeAccessAction(prev, form);
    if (result.ok) setPicked(new Set());
    return result;
  }, idle);
  return (
    <Card className="overflow-hidden">
      <form action={action} onSubmit={(e) => { if (!confirm(`Remove access for ${picked.size} ${picked.size === 1 ? "person" : "people"}?`)) e.preventDefault(); }}>
        {[...picked].map((id) => <input key={id} type="hidden" name="assignmentIds" value={id} />)}
        <div className="flex items-center justify-between gap-2 border-b border-line bg-paper/60 px-4 py-2">
          <p className="text-[13px] font-bold">{name} <span className="font-normal text-muted">· {list.length}</span></p>
          {canEdit && picked.size > 0 && (
            <button className={buttonClass("danger", "sm")}>Remove {picked.size}</button>
          )}
        </div>
      </form>
      <ul className="divide-y divide-line">
        {list.map((a) => (
          <li key={a.id} className="flex items-start gap-3 px-4 py-3">
            {canEdit && (
              <input type="checkbox" aria-label={`Select ${a.full_name}`} className="mt-1 size-4 accent-ink" checked={picked.has(a.id)}
                onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                <a href={`/office/people/${a.user_id}`} className="hover:underline">{a.full_name}</a>
                {a.role === "manager" && <Badge tone="info" className="ml-2">Manager</Badge>}
                {!a.user_active && <Badge tone="danger" className="ml-2">Deactivated</Badge>}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {a.all_areas ? <Badge tone="dark">All areas</Badge> : a.area_names.length ? a.area_names.map((n) => <Badge key={n} tone="signal">{n}</Badge>) : <Badge>Job-wide information only</Badge>}
                {a.can_view_company_reports && <Badge tone="info">Sees {a.company_name} reports</Badge>}
              </div>
              <p className="mt-1 text-[12px] text-muted">
                {[dateRange(a.attendance_from, a.attendance_to), a.note, a.granted_by_name ? `granted by ${a.granted_by_name}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            {canEdit && (
              <button type="button" onClick={() => onEdit(a)} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-paper" aria-label={`Edit ${a.full_name}'s access`}>
                <PencilSimple className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {state.error && <p className="px-4 pb-3 text-[13px] text-danger">{state.error}</p>}
      {state.ok && state.message && <p className="px-4 pb-3 text-[13px] text-ok">{state.message}</p>}
    </Card>
  );
}

export function RevokedHistory({ items }: { items: { id: string; full_name: string; company_name: string; granted_at: string; revoked_at: string; revoked_by_name: string | null; note: string | null }[] }) {
  if (!items.length) return null;
  return (
    <details className="mt-6">
      <summary className="cursor-pointer text-[13px] font-bold uppercase tracking-[0.08em] text-muted">Previous access · {items.length}</summary>
      <Card className="mt-3 divide-y divide-line">
        {items.map((r) => (
          <div key={r.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-[14px]">
            <span><span className="font-medium">{r.full_name}</span> <span className="text-muted">· {r.company_name}{r.note ? ` · ${r.note}` : ""}</span></span>
            <span className="text-[13px] text-muted">{dateRange(r.granted_at.slice(0, 10), r.revoked_at.slice(0, 10))}{r.revoked_by_name ? ` · removed by ${r.revoked_by_name}` : ""}</span>
          </div>
        ))}
      </Card>
    </details>
  );
}

