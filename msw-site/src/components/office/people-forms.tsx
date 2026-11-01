"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createCompanyAction, invitePersonAction, resetPasswordAction, setCompanyActiveAction, setPersonActiveAction,
  updateCompanyAction, updatePersonAction,
} from "@/server/actions/people";
import { idle } from "@/lib/action-state";
import { Alert, Field, Input, Select } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";
import { buttonClass } from "@/components/ui/button";

type Company = { id: string; name: string; is_msw: boolean };

function RoleSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <Select id="role" name="role" defaultValue={defaultValue ?? "operative"}>
      <option value="operative">Operative — sees only jobs you allocate</option>
      <option value="manager">Subcontractor manager — sees only jobs you allocate</option>
      <option value="office">MSW office — all jobs, cannot change access</option>
      <option value="admin">MSW administrator — full control</option>
    </Select>
  );
}

export function InvitePersonForm({ companies, defaultCompanyId, demo }: { companies: Company[]; defaultCompanyId?: string; demo: boolean }) {
  const [state, action] = useActionState(invitePersonAction, idle);
  const e = state.fieldErrors ?? {};
  if (state.ok && state.secret) {
    return (
      <div className="grid gap-4">
        <Alert tone="ok" title="Account created">{state.message}</Alert>
        <div className="rounded-xl border-2 border-dashed border-ink/30 bg-card p-4 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted">Temporary password — shown once</p>
          <p className="mt-1 select-all font-mono text-2xl font-bold tracking-wide">{state.secret}</p>
        </div>
        <div className="flex gap-2">
          {state.href && <Link href={state.href} className={buttonClass("dark", "md")}>View person &amp; allocate jobs</Link>}
          <Link href="/office/people/new" className={buttonClass("secondary", "md")} onClick={() => location.reload()}>Add another</Link>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" error={e.fullName}><Input id="fullName" name="fullName" required /></Field>
        <Field label="Email" htmlFor="email" error={e.email} hint="They sign in with this."><Input id="email" name="email" type="email" required /></Field>
        <Field label="Mobile" htmlFor="phone" optional><Input id="phone" name="phone" type="tel" /></Field>
        <Field label="Job title" htmlFor="jobTitle" optional><Input id="jobTitle" name="jobTitle" placeholder="Metal Deck Fixer" /></Field>
        <Field label="Employer" htmlFor="companyId" error={e.companyId}>
          <Select id="companyId" name="companyId" defaultValue={defaultCompanyId ?? companies.find((c) => !c.is_msw)?.id}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_msw ? " (direct employee)" : ""}</option>)}
          </Select>
        </Field>
        <Field label="Role" htmlFor="role" error={e.role}><RoleSelect /></Field>
      </div>
      <Alert tone="info">
        New accounts can&apos;t see any job until you allocate them on a job&apos;s People &amp; access tab.
        {demo ? " Demo mode: no email is sent — a temporary password is shown instead." : " They will receive an invitation email from Supabase Auth to set their password."}
      </Alert>
      <SubmitButton className="justify-self-start" pendingText="Creating…">{demo ? "Create account" : "Send invitation"}</SubmitButton>
    </form>
  );
}

export function EditPersonForm({ person, companies, isSelf }: {
  person: { id: string; full_name: string; phone: string | null; job_title: string | null; company_id: string; role: string };
  companies: Company[]; isSelf: boolean;
}) {
  const [state, action] = useActionState(updatePersonAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="userId" value={person.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" error={e.fullName}><Input id="fullName" name="fullName" defaultValue={person.full_name} /></Field>
        <Field label="Mobile" htmlFor="phone" optional><Input id="phone" name="phone" defaultValue={person.phone ?? ""} /></Field>
        <Field label="Job title" htmlFor="jobTitle" optional><Input id="jobTitle" name="jobTitle" defaultValue={person.job_title ?? ""} /></Field>
        <Field label="Employer" htmlFor="companyId">
          <Select id="companyId" name="companyId" defaultValue={person.company_id}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Role" htmlFor="role" className="sm:col-span-2" hint={isSelf ? "You can't remove your own administrator role." : "Changing employer does not change their job access."}><RoleSelect defaultValue={person.role} /></Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton size="md" variant="dark" className="justify-self-start">Save</SubmitButton>
    </form>
  );
}

export function PersonAccountControls({ userId, active, isSelf, demo }: { userId: string; active: boolean; isSelf: boolean; demo: boolean }) {
  const [activeState, toggle] = useActionState(setPersonActiveAction, idle);
  const [resetState, reset] = useActionState(resetPasswordAction, idle);
  return (
    <div className="grid gap-4">
      <form action={toggle} onSubmit={(e) => { if (active && !confirm("Deactivate this account? They will be signed out and lose all job access immediately.")) e.preventDefault(); }} className="grid gap-2">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="active" value={active ? "0" : "1"} />
        <button disabled={isSelf} className={buttonClass(active ? "danger" : "success", "md", "justify-self-start")}>{active ? "Deactivate account" : "Reactivate account"}</button>
        <FormMessage state={activeState} />
      </form>
      <form action={reset} className="grid gap-2">
        <input type="hidden" name="userId" value={userId} />
        <button className={buttonClass("secondary", "md", "justify-self-start")}>{demo ? "Create temporary password" : "Send password reset email"}</button>
        <FormMessage state={resetState} />
        {resetState.secret && <p className="select-all rounded-lg bg-paper p-3 text-center font-mono text-xl font-bold">{resetState.secret}</p>}
      </form>
    </div>
  );
}

export function CompanyForm({ company }: { company?: { id: string; name: string; trade: string | null; contact_name: string | null; contact_phone: string | null; contact_email: string | null } }) {
  const [state, action] = useActionState(company ? updateCompanyAction : createCompanyAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      {company && <input type="hidden" name="companyId" value={company.id} />}
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" htmlFor="name" error={e.name}><Input id="name" name="name" defaultValue={company?.name} required /></Field>
        <Field label="Trade" htmlFor="trade" optional><Input id="trade" name="trade" defaultValue={company?.trade ?? ""} placeholder="Metal decking" /></Field>
        <Field label="Contact name" htmlFor="contactName" optional><Input id="contactName" name="contactName" defaultValue={company?.contact_name ?? ""} /></Field>
        <Field label="Contact phone" htmlFor="contactPhone" optional><Input id="contactPhone" name="contactPhone" defaultValue={company?.contact_phone ?? ""} /></Field>
        <Field label="Contact email" htmlFor="contactEmail" optional error={e.contactEmail}><Input id="contactEmail" name="contactEmail" type="email" defaultValue={company?.contact_email ?? ""} /></Field>
      </div>
      <SubmitButton size="md" variant="dark" className="justify-self-start">{company ? "Save company" : "Create company"}</SubmitButton>
    </form>
  );
}

export function CompanyActiveToggle({ companyId, active }: { companyId: string; active: boolean }) {
  const [state, action] = useActionState(setCompanyActiveAction, idle);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <button className={buttonClass(active ? "danger" : "success", "sm", "justify-self-start")}>{active ? "Deactivate company" : "Reactivate company"}</button>
      <FormMessage state={state} />
    </form>
  );
}
