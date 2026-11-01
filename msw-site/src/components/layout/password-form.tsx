"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/server/actions/account";
import { idle } from "@/lib/action-state";
import { Field, Input } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";

export function PasswordForm({ needsCurrent }: { needsCurrent: boolean }) {
  const [state, action] = useActionState(changePasswordAction, idle);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      {needsCurrent && (
        <Field label="Current password" htmlFor="current" error={state.fieldErrors?.current}>
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </Field>
      )}
      <Field label="New password" htmlFor="next" hint="At least 10 characters." error={state.fieldErrors?.next}>
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={state.fieldErrors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton variant="dark" className="justify-self-start">Change password</SubmitButton>
    </form>
  );
}
