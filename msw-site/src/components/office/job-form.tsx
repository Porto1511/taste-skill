"use client";

import { useActionState } from "react";
import { createJobAction, updateJobAction } from "@/server/actions/jobs";
import { idle } from "@/lib/action-state";
import type { OfficeJob } from "@/server/queries/office";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";

export function JobForm({ job, staff }: { job?: OfficeJob["job"]; staff: OfficeJob["staff"] }) {
  const [state, action] = useActionState(job ? updateJobAction : createJobAction, idle);
  const e = state.fieldErrors ?? {};
  const v = (k: keyof OfficeJob["job"]) => (job?.[k] as string | null | undefined) ?? "";
  return (
    <form action={action} className="grid gap-6" key={job?.updated_at}>
      {job && <input type="hidden" name="jobId" value={job.id} />}
      <FormMessage state={state} />
      <Card className="grid gap-4 p-5">
        <SectionTitle className="mb-0">Project</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <Field label="MSW job number" htmlFor="jobNumber" error={e.jobNumber}><Input id="jobNumber" name="jobNumber" defaultValue={v("job_number")} className="font-mono uppercase" placeholder="MSW-2630" required /></Field>
          <Field label="Project name" htmlFor="name" error={e.name}><Input id="name" name="name" defaultValue={v("name")} required /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue={v("status") || "planned"}>
            <option value="planned">Planned</option><option value="live">Live</option><option value="on_hold">On hold</option><option value="complete">Complete</option>
          </Select></Field>
          <Field label="Start date" htmlFor="startDate" optional error={e.startDate}><Input id="startDate" name="startDate" type="date" defaultValue={v("start_date")} /></Field>
          <Field label="End date" htmlFor="endDate" optional error={e.endDate}><Input id="endDate" name="endDate" type="date" defaultValue={v("end_date")} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Main contractor" htmlFor="mainContractor" optional><Input id="mainContractor" name="mainContractor" defaultValue={v("main_contractor")} /></Field>
          <Field label="MSW contracts manager" htmlFor="contractsManagerId" hint="Receives notifications for this job's site reports.">
            <Select id="contractsManagerId" name="contractsManagerId" defaultValue={v("contracts_manager_id")}>
              <option value="">— All administrators —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.job_title ? ` (${s.job_title})` : ""}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="grid gap-4 p-5">
        <SectionTitle className="mb-0">Site location &amp; contact</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Site address" htmlFor="siteAddress" error={e.siteAddress}><Input id="siteAddress" name="siteAddress" defaultValue={v("site_address")} required /></Field>
          <Field label="Postcode" htmlFor="postcode" optional><Input id="postcode" name="postcode" defaultValue={v("postcode")} className="uppercase" /></Field>
        </div>
        <Field label="Directions & access" htmlFor="directions" optional hint="Gate, parking, sign-in point — shown to operatives with a Directions button.">
          <Textarea id="directions" name="directions" defaultValue={v("directions")} rows={3} />
        </Field>
        <Field label="what3words" htmlFor="what3words" optional><Input id="what3words" name="what3words" defaultValue={v("what3words")} placeholder="///word.word.word" /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Site contact" htmlFor="siteContactName" optional><Input id="siteContactName" name="siteContactName" defaultValue={v("site_contact_name")} /></Field>
          <Field label="Role" htmlFor="siteContactRole" optional><Input id="siteContactRole" name="siteContactRole" defaultValue={v("site_contact_role")} placeholder="Site Manager" /></Field>
          <Field label="Phone" htmlFor="siteContactPhone" optional hint="Tap-to-call on site."><Input id="siteContactPhone" name="siteContactPhone" type="tel" defaultValue={v("site_contact_phone")} /></Field>
        </div>
      </Card>

      <Card className="grid gap-4 p-5">
        <SectionTitle className="mb-0">Induction &amp; site instructions</SectionTitle>
        <Field label="Online induction link" htmlFor="inductionUrl" optional error={e.inductionUrl}><Input id="inductionUrl" name="inductionUrl" type="url" defaultValue={v("induction_url")} placeholder="https://" /></Field>
        <Field label="Induction notes" htmlFor="inductionNotes" optional><Textarea id="inductionNotes" name="inductionNotes" defaultValue={v("induction_notes")} rows={2} /></Field>
        <Field label="Site instructions" htmlFor="siteInstructions" optional hint="Working hours, hoist bookings, permits, exclusion zones. Assigned people are notified when this changes.">
          <Textarea id="siteInstructions" name="siteInstructions" defaultValue={v("site_instructions")} rows={8} />
        </Field>
      </Card>
      <div className="flex justify-end"><SubmitButton pendingText="Saving…">{job ? "Save changes" : "Create job"}</SubmitButton></div>
    </form>
  );
}
