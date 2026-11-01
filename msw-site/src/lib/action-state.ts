/** Shape returned by every server action used with useActionState. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Shown once (e.g. a temporary password in demo mode). */
  secret?: string;
  /** Follow-up link (e.g. to the record just created). */
  href?: string;
  nonce?: number;
};

export const idle: ActionState = {};
