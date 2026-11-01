import { log } from "./log";

/** An error whose message is safe and useful to show to the user. */
export class UserError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "UserError";
  }
}

const constraintMessages: Record<string, string> = {
  jobs_number_key: "A job with that job number already exists.",
  companies_name_key: "A company with that name already exists.",
  profiles_email_key: "Someone with that email address already has an account.",
  job_areas_name_key: "This job already has an area with that name.",
  documents_number_key: "A document with that number already exists on this job.",
  document_revisions_rev_key: "That revision already exists for this document.",
  jobs_dates: "The end date must be after the start date.",
  job_assignments_dates: "The attendance end date must be after the start date.",
  assignment_areas_area_id_fkey: "That area is still allocated to people. Remove it from their access first.",
  document_areas_area_id_fkey: "That area still has documents assigned to it. Update those documents first.",
  reports_area_id_fkey: "That area has site reports recorded against it and cannot be removed.",
};

type PgLikeError = { code?: string; message?: string; constraint?: string; detail?: string };

/** Convert any thrown error into a message suitable for the UI, logging the original. */
export function toUserMessage(err: unknown, context: string): string {
  if (err instanceof UserError) return err.message;
  const e = (err ?? {}) as PgLikeError;
  const constraint = e.constraint ?? /constraint "([^"]+)"/.exec(e.message ?? "")?.[1];
  if (constraint && constraintMessages[constraint]) {
    return constraintMessages[constraint];
  }
  switch (e.code) {
    case "42501":
      // Our own functions raise readable messages; raw RLS denials are generic.
      if (e.message && !/row-level security|permission denied/i.test(e.message)) return e.message;
      log.warn("authz.denied", { context, message: e.message });
      return "You don't have permission to do that.";
    case "22023":
    case "P0002":
    case "23514":
      if (e.message && !/violates check constraint/i.test(e.message)) return e.message;
      return "Some of the details entered are not valid.";
    case "23505":
      return "That record already exists.";
    case "23503":
      return "This item is linked to other records and can't be changed that way.";
    case "22P02":
      return "The request contained an invalid identifier.";
  }
  log.error("unexpected.error", { context, err });
  return "Something went wrong. Please try again, and contact the MSW office if it keeps happening.";
}
