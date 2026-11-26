"use client";

import { useActionState, useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { addOperativeAction, setJobAccessAction, setOperativeActiveAction, updateOperativeAction } from "@/server/actions/company";
import { idle } from "@/lib/action-state";
import { Field, Input } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";
import { cn } from "@/lib/cn";

export function AddOperativeForm() {
  const [state, action] = useActionState(addOperativeAction, idle);
  const [show, setShow] = useState(false);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <Field label="Name" htmlFor="fullName" error={fe.fullName}><Input id="fullName" name="fullName" autoComplete="off" required maxLength={120} /></Field>
      <Field label="Email" htmlFor="email" error={fe.email} hint="They sign in with this.">
        <Input id="email" name="email" type="email" autoComplete="off" inputMode="email" required maxLength={200} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" htmlFor="phone" optional error={fe.phone}><Input id="phone" name="phone" type="tel" maxLength={40} /></Field>
        <Field label="Job title" htmlFor="jobTitle" optional error={fe.jobTitle}><Input id="jobTitle" name="jobTitle" placeholder="e.g. Netting & deck" maxLength={120} /></Field>
      </div>
      <Field label="Password" htmlFor="password" error={fe.password} hint="You set it and tell them. They can change it under Me.">
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} required className="pr-12" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Adding…">Add to my company</SubmitButton>
    </form>
  );
}

export function EditOperativeForm({ person }: { person: { id: string; full_name: string; phone: string | null; job_title: string | null } }) {
  const [state, action] = useActionState(updateOperativeAction, idle);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="userId" value={person.id} />
      <Field label="Name" htmlFor="fullName" error={fe.fullName}><Input id="fullName" name="fullName" defaultValue={person.full_name} required maxLength={120} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" htmlFor="phone" optional><Input id="phone" name="phone" type="tel" defaultValue={person.phone ?? ""} maxLength={40} /></Field>
        <Field label="Job title" htmlFor="jobTitle" optional><Input id="jobTitle" name="jobTitle" defaultValue={person.job_title ?? ""} maxLength={120} /></Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="dark" size="md" className="justify-self-start">Save details</SubmitButton>
    </form>
  );
}

export function ActiveToggle({ userId, active, name }: { userId: string; active: boolean; name: string }) {
  const [state, action] = useActionState(setOperativeActiveAction, idle);
  return (
    <form action={action} onSubmit={(e) => { if (active && !confirm(`Switch off ${name}? They'll be signed out and won't see any job.`)) e.preventDefault(); }} className="grid gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <SubmitButton variant={active ? "danger" : "success"} size="lg" pendingText={active ? "Switching off…" : "Switching on…"}>
        {active ? "Switch off — they've left" : "Switch back on"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** One tick box: this person on this job. Saves straight away. */
export function JobTick({ jobId, userId, on, label, sub, disabled }: { jobId: string; userId: string; on: boolean; label: string; sub?: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(setJobAccessAction, idle);
  return (
    <form action={action}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="on" value={on ? "0" : "1"} />
      <button type="submit" disabled={pending || disabled} role="switch" aria-checked={on} aria-label={`${label} can see this job`}
        className={cn("flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left ring-1 transition-colors disabled:opacity-60",
          on ? "bg-ok-soft ring-ok/40" : "bg-card ring-line")}>
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border-2 text-white", on ? "border-ok bg-ok" : "border-line-strong bg-white")}>
          {on && <svg viewBox="0 0 16 16" className="size-4" aria-hidden><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-tight">{label}</span>
          {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
        </span>
        <span className="text-[13px] font-semibold text-muted">{pending ? "Saving…" : on ? "Can see it" : "Can't see it"}</span>
      </button>
      {state.error && <p className="mt-1 text-[13px] font-medium text-danger" role="alert">{state.error}</p>}
    </form>
  );
}

