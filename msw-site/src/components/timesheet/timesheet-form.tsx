"use client";

import { useActionState, useMemo, useState } from "react";
import { Car, Users, PersonSimpleWalk } from "@phosphor-icons/react";
import { saveTimesheetAction } from "@/server/actions/timesheets";
import { idle } from "@/lib/action-state";
import type { TimesheetRow } from "@/server/queries/timesheets";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/form-client";
import { fmtMinutes } from "@/lib/format";
import { cn } from "@/lib/cn";

const toMin = (t: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
const span = (a: string, b: string) => {
  const x = toMin(a), y = toMin(b);
  if (x === null || y === null) return 0;
  return y >= x ? y - x : y - x + 1440;
};

function TimePair({ title, a, b, la, lb, values, set, error }: {
  title: string; a: string; b: string; la: string; lb: string; values: Record<string, string>; set: (k: string, v: string) => void; error?: string;
}) {
  return (
    <fieldset className="rounded-2xl border border-line bg-card p-3">
      <legend className="px-1 text-[13px] font-bold">{title}</legend>
      <div className="grid grid-cols-2 gap-2">
        {[[a, la], [b, lb]].map(([k, l]) => (
          <label key={k} className="grid gap-1 text-[12px] font-semibold text-muted">
            {l}
            <input type="time" name={k} value={values[k]} onChange={(e) => set(k, e.target.value)}
              className="h-14 rounded-xl border border-line-strong bg-white px-3 text-[20px] font-semibold text-ink tabular focus:border-ink focus:outline-none" />
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-[13px] font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

export function TimesheetForm({ date, sheet, jobs, last, readOnly }: {
  date: string; sheet: TimesheetRow | null; jobs: { id: string; job_number: string; name: string }[];
  last: { vehicle_reg: string | null; travel_mode: string } | null; readOnly: boolean;
}) {
  const [state, action] = useActionState(saveTimesheetAction, idle);
  const [mode, setMode] = useState<string>(sheet?.travel_mode ?? last?.travel_mode ?? "driver");
  const [jobId, setJobId] = useState(sheet ? sheet.job_id ?? "other" : jobs.length === 1 ? jobs[0].id : "");
  const [v, setV] = useState<Record<string, string>>({
    travelOutStart: sheet?.travel_out_start ?? "", travelOutEnd: sheet?.travel_out_end ?? "",
    siteStart: sheet?.site_start ?? "", siteFinish: sheet?.site_finish ?? "",
    travelBackStart: sheet?.travel_back_start ?? "", travelBackEnd: sheet?.travel_back_end ?? "",
  });
  const [breakMins, setBreak] = useState(String(sheet?.break_minutes ?? 30));
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));
  const totals = useMemo(() => {
    const travel = mode === "none" ? 0 : span(v.travelOutStart, v.travelOutEnd) + span(v.travelBackStart, v.travelBackEnd);
    const site = Math.max(span(v.siteStart, v.siteFinish) - Number(breakMins || 0), 0);
    return { travel, driving: mode === "driver" ? travel : 0, site };
  }, [v, mode, breakMins]);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="workDate" value={date} />
      <input type="hidden" name="travelMode" value={mode} />
      <fieldset disabled={readOnly} className="grid gap-4 disabled:opacity-80">
        <Field label="Job" htmlFor="jobId">
          <Select id="jobId" name="jobId" value={jobId} onChange={(e) => setJobId(e.target.value)} required>
            <option value="" disabled>Choose…</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.job_number} · {j.name}</option>)}
            <option value="other">Other (yard, training, travel only…)</option>
          </Select>
        </Field>
        {jobId === "other" && (
          <Field label="Where / what" htmlFor="locationNote"><Input id="locationNote" name="locationNote" defaultValue={sheet?.location_note ?? ""} placeholder="e.g. Yard — loading netting" maxLength={200} /></Field>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Travel</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {([["driver", "Driving", Car], ["passenger", "Passenger", Users], ["none", "No travel", PersonSimpleWalk]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}
                className={cn("flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-[13px] font-semibold",
                  mode === id ? "border-ink bg-ink text-white" : "border-line-strong bg-card")}>
                <Icon className="size-5" weight={mode === id ? "fill" : "regular"} />{label}
              </button>
            ))}
          </div>
        </fieldset>
        {mode !== "none" && (
          <Field label="Vehicle reg" htmlFor="vehicleReg" error={fe.vehicleReg} optional={mode === "passenger"}>
            <Input id="vehicleReg" name="vehicleReg" defaultValue={sheet?.vehicle_reg ?? last?.vehicle_reg ?? ""} className="font-mono uppercase" placeholder="AB12 CDE" maxLength={12} autoCapitalize="characters" />
          </Field>
        )}

        {mode !== "none" && <TimePair title="Travel to site" a="travelOutStart" b="travelOutEnd" la="Set off" lb="Arrived" values={v} set={set} error={fe.travelOutStart} />}
        <TimePair title="On site" a="siteStart" b="siteFinish" la="Start" lb="Finish" values={v} set={set} error={fe.siteStart} />
        <Field label="Breaks" htmlFor="breakMinutes">
          <Select id="breakMinutes" name="breakMinutes" value={breakMins} onChange={(e) => setBreak(e.target.value)}>
            {[0, 15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m ? `${m} minutes` : "No break"}</option>)}
          </Select>
        </Field>
        {mode !== "none" && <TimePair title="Travel home" a="travelBackStart" b="travelBackEnd" la="Left site" lb="Got home" values={v} set={set} error={fe.travelBackStart} />}

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-ink p-3 text-center text-white">
          {[["On site", totals.site], ["Driving", totals.driving], ["Travel", totals.travel]].map(([l, m]) => (
            <div key={l as string}><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{l}</p><p className="tabular text-[20px] font-semibold">{fmtMinutes(m as number)}</p></div>
          ))}
        </div>
        {totals.driving > 600 && <Alert tone="warn">That&apos;s over 10 hours driving. Check the times, and speak to the office if that&apos;s right.</Alert>}

        <Field label="Miles" htmlFor="mileage" optional><Input id="mileage" name="mileage" type="number" inputMode="numeric" min={0} max={2000} defaultValue={sheet?.mileage ?? ""} /></Field>
        <Field label="Notes" htmlFor="notes" optional><Textarea id="notes" name="notes" defaultValue={sheet?.notes ?? ""} rows={2} className="min-h-0" maxLength={1000} /></Field>
      </fieldset>

      {state.error && <Alert>{state.error}</Alert>}
      {!readOnly && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 bg-paper/95 px-4 py-2 backdrop-blur">
          <SubmitButton size="xl" className="w-full" pendingText="Saving…">{sheet ? "Update & resubmit" : "Submit day"}</SubmitButton>
        </div>
      )}
    </form>
  );
}
