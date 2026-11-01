"use client";

import { useActionState } from "react";
import { signInAction } from "./actions";
import { idle } from "@/lib/action-state";
import { Field, Input } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, idle);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required
          aria-invalid={Boolean(state.fieldErrors?.email)} placeholder="name@company.co.uk" />
      </Field>
      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required
          aria-invalid={Boolean(state.fieldErrors?.password)} />
      </Field>
      <SubmitButton size="xl" className="mt-1 w-full" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
