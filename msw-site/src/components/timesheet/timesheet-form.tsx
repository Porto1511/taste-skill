"use client";

import { useActionState, useMemo, useState } from "react";
import { Car, Users } from "@phosphor-icons/react";
import { saveTimesheetAction } from "@/server/actions/timesheets";
import { idle } from "@/lib/action-state";
import type { TimesheetRow } from "@/server/queries/timesheets";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/form-client";
import { fmtMinutes } from "@/lib/format";
import { WORK_TYPES } from "@/lib/timesheet";
import { cn } from "@/lib/cn";

const toMin = (t: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
const span = (a: string, b: string) => {
  const x = toMin(a), y = toMin(b);
  if (x === null || y === null) return 0;
  return y >= x ? y - x : y - x + 1440;
};

function TimeField({ name, label, hint, value, onChange, error }: {
  name: string; label: string; hint?: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[13px] font-semibold">{label}</span>
      <input type="time" name={name} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)}
        className="h-14 rounded-xl border border-line-strong bg-white px-3 text-[20px] font-semibold text-ink tabular focus:border-ink focus:outline-none aria-invalid:border-danger" />
      {error ? <span className="text-[12px] font-medium text-danger">{error}</span> : hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function TimesheetForm({ date, sheet, jobs, last, readOnly, previous }: {
  date: string; sheet: TimesheetRow | null; jobs: { id: string; job_number: string; name: string }[];
  last: { vehicle_reg: string | null; travel_mode: string } | null; readOnly: boolean;
  /** The day's previous job, when adding another: you set off when you left that site. */
  previous?: TimesheetRow | null;
}) {
  const [state, action] = useActionState(saveTimesheetAction, idle);
  const initialMode = sheet?.travel_mode === "passenger" || (!sheet && last?.travel_mode === "passenger") ? "passenger" : "driver";
  const [mode, setMode] = useState<"driver" | "passenger">(initialMode);
  const [jobId, setJobId] = useState(sheet ? sheet.job_id ?? "other" : jobs.length === 1 && !previous ? jobs[0].id : "");
  const [work, setWork] = useState<string[]>(sheet?.work_done ?? []);
  // Weekends default to premium; anyone can untick it (or tick it on a weekday).
  const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
  const [premium, setPremium] = useState(sheet ? sheet.premium : weekend);
  const [t, setT] = useState({
    setOff: sheet?.travel_out_start ?? previous?.travel_back_start ?? "",
    arrived: sheet?.travel_out_end ?? "",
    leftSite: sheet?.travel_back_start ?? "",
    gotBack: sheet?.travel_back_end ?? "",
  });
  const set = (k: keyof typeof t) => (v: string) => setT((s) => ({ ...s, [k]: v }));
  const totals = useMemo(() => {
    const travel = span(t.setOff, t.arrived) + span(t.leftSite, t.gotBack);
    return { there: span(t.setOff, t.arrived), site: span(t.arrived, t.leftSite), back: span(t.leftSite, t.gotBack), travel };
  }, [t]);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="workDate" value={date} />
      <input type="hidden" name="travelMode" value={mode} />
      {sheet && <input type="hidden" name="entryId" value={sheet.id} />}
      {work.map((w) => <input key={w} type="hidden" name="workDone" value={w} />)}
      {premium && <input type="hidden" name="premium" value="1" />}
      <fieldset disabled={readOnly} className="grid gap-5 disabled:opacity-80">
        {/* 1. Job */}
        <Field label="Job" htmlFor="jobId" error={fe.jobId}>
          <Select id="jobId" name="jobId" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="" disabled>Choose…</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.job_number} · {j.name}</option>)}
            <option value="other">Other (yard, delivery…)</option>
          </Select>
        </Field>
        {jobId === "other" && (
          <Field label="Where" htmlFor="locationNote" error={fe.locationNote}>
            <Input id="locationNote" name="locationNote" defaultValue={sheet?.location_note ?? ""} placeholder="e.g. Yard, or delivery to Leeds" maxLength={200} />
          </Field>
        )}

        {/* 2. What was done */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">What did you do?</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {WORK_TYPES.map((w) => {
              const on = work.includes(w.id);
              return (
                <button key={w.id} type="button" aria-pressed={on}
                  onClick={() => setWork((all) => (on ? all.filter((x) => x !== w.id) : [...all, w.id]))}
                  className={cn("h-12 rounded-xl border text-[15px] font-semibold", on ? "border-ink bg-ink text-white" : "border-line-strong bg-card")}>
                  {w.label}
                </button>
              );
            })}
          </div>
          {fe.workDone && <p className="mt-1.5 text-[13px] font-medium text-danger">{fe.workDone}</p>}
          <Textarea name="workDescription" defaultValue={sheet?.work_description ?? ""} rows={2} maxLength={1000}
            className="mt-2 min-h-0" placeholder="e.g. Laid and pinned bays A1–D3, Level 1" aria-label="Details of work done" />
        </fieldset>

        <label className={cn("flex items-center gap-3 rounded-2xl border-2 p-4", premium ? "border-signal bg-signal-soft" : "border-line bg-card")}>
          <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} className="size-6 shrink-0 accent-ink" />
          <span><span className="block text-[16px] font-semibold">Premium time</span>
            <span className="block text-[13px] text-muted">{weekend ? "Ticked because it's the weekend — untick if it isn't premium." : "Tick if this is premium time (e.g. Saturday or nights)."}</span></span>
        </label>

        {/* 3. Travel */}
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-semibold">Travel</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {([["driver", "I drove", Car], ["passenger", "Passenger", Users]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}
                className={cn("flex h-12 items-center justify-center gap-2 rounded-xl border text-[15px] font-semibold",
                  mode === id ? "border-ink bg-ink text-white" : "border-line-strong bg-card")}>
                <Icon className="size-5" weight={mode === id ? "fill" : "regular"} />{label}
              </button>
            ))}
          </div>
          {mode === "driver" ? (
            <Field label="Vehicle reg" htmlFor="vehicleReg" error={fe.vehicleReg}>
              <Input id="vehicleReg" name="vehicleReg" defaultValue={sheet?.vehicle_reg ?? last?.vehicle_reg ?? ""} className="font-mono uppercase" placeholder="AB12 CDE" maxLength={12} autoCapitalize="characters" />
            </Field>
          ) : (
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <Field label="Who was driving?" htmlFor="drivenBy" error={fe.drivenBy}>
                <Input id="drivenBy" name="drivenBy" defaultValue={sheet?.driven_by ?? ""} placeholder="Name" maxLength={120} />
              </Field>
              <Field label="Reg" htmlFor="vehicleReg" optional>
                <Input id="vehicleReg" name="vehicleReg" defaultValue={sheet?.vehicle_reg ?? ""} className="font-mono uppercase" maxLength={12} autoCapitalize="characters" />
              </Field>
            </div>
          )}
          <p className="text-[12.5px] text-muted">{mode === "driver" ? "Your travel counts as driving hours." : "Your travel counts as travel time, not driving hours."}</p>
        </fieldset>

        {/* 4. Times */}
        <fieldset className="grid gap-3 rounded-2xl border border-line bg-card p-3">
          <legend className="px-1 text-sm font-semibold">Times</legend>
          <div className="grid grid-cols-2 gap-2">
            <TimeField name="setOff" label="Set off" value={t.setOff} onChange={set("setOff")} error={fe.setOff}
              hint={previous && !sheet ? "From your last job" : undefined} />
            <TimeField name="arrived" label="Arrived on site" value={t.arrived} onChange={set("arrived")} error={fe.arrived} />
            <TimeField name="leftSite" label="Left site" value={t.leftSite} onChange={set("leftSite")} error={fe.leftSite} />
            <TimeField name="gotBack" label="Got back" value={t.gotBack} onChange={set("gotBack")}
              hint="Leave blank if you went on to another job" />
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-ink p-3 text-center text-white">
          {[["Travel there", totals.there], ["On site", totals.site], ["Travel back", totals.back]].map(([l, m]) => (
            <div key={l as string}><p className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/70">{l}</p><p className="tabular text-[19px] font-semibold">{fmtMinutes(m as number)}</p></div>
          ))}
        </div>

        <details className="group">
          <summary className="cursor-pointer text-[14px] font-semibold text-muted">Miles and notes (optional)</summary>
          <div className="mt-3 grid gap-4">
            <Field label="Miles" htmlFor="mileage" optional><Input id="mileage" name="mileage" type="number" inputMode="numeric" min={0} max={2000} defaultValue={sheet?.mileage ?? ""} /></Field>
            <Field label="Notes" htmlFor="notes" optional><Textarea id="notes" name="notes" defaultValue={sheet?.notes ?? ""} rows={2} className="min-h-0" maxLength={1000} /></Field>
          </div>
        </details>
      </fieldset>

      {state.error && <Alert>{state.error}</Alert>}
      {!readOnly && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 bg-paper/95 px-4 py-2 backdrop-blur">
          <SubmitButton size="xl" className="w-full" pendingText="Saving…">{sheet ? "Save changes" : "Save this job"}</SubmitButton>
        </div>
      )}
    </form>
  );
}
