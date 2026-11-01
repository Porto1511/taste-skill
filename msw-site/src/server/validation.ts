import { z } from "zod";

const uuid = z.string().uuid("Invalid identifier");
const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer`).optional().transform((v) => (v ? v : null));
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date");

export const reportInput = z
  .object({
    jobId: uuid,
    kind: z.enum(["issue", "progress", "photo"]),
    category: z.enum(["delay", "access", "edge_protection", "materials", "drawing_query", "safety", "other"]).optional(),
    priority: z.enum(["normal", "high", "urgent"]).default("normal"),
    areaId: z.string().optional().transform((v) => (v ? v : null)).pipe(uuid.nullable()),
    title: optionalText(160),
    description: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "issue" && !v.category) ctx.addIssue({ code: "custom", path: ["category"], message: "Choose what kind of issue this is" });
    if (v.kind === "issue" && (!v.title || v.title.length < 3)) ctx.addIssue({ code: "custom", path: ["title"], message: "Give the issue a short title" });
    if (v.kind === "progress" && !v.description && !v.title) ctx.addIssue({ code: "custom", path: ["description"], message: "Describe the progress made" });
  });

export const documentInput = z.object({
  jobId: uuid,
  kind: z.enum(["drawing", "rams"]),
  docNumber: z.string().trim().min(1, "Enter the document number").max(60),
  title: z.string().trim().min(2, "Enter a title").max(200),
  description: optionalText(1000),
  areaIds: z.array(uuid).default([]),
  revision: z.string().trim().min(1, "Enter the revision").max(12),
  changeNote: optionalText(1000),
  approve: z.boolean().default(false),
});

export const revisionInput = z.object({
  documentId: uuid,
  revision: z.string().trim().min(1, "Enter the revision").max(12),
  changeNote: optionalText(1000),
  approve: z.boolean().default(false),
});

export const jobInput = z
  .object({
    jobNumber: z.string().trim().min(2, "Enter the MSW job number").max(40),
    name: z.string().trim().min(2, "Enter the project name").max(160),
    siteAddress: z.string().trim().min(3, "Enter the site address").max(400),
    postcode: optionalText(12),
    what3words: optionalText(80),
    directions: optionalText(2000),
    mainContractor: optionalText(160),
    siteContactName: optionalText(120),
    siteContactRole: optionalText(120),
    siteContactPhone: optionalText(40),
    startDate: optionalDate,
    endDate: optionalDate,
    inductionUrl: optionalText(500).refine((v) => v === null || /^https?:\/\//i.test(v), "Link must start with https://"),
    inductionNotes: optionalText(2000),
    siteInstructions: optionalText(8000),
    status: z.enum(["planned", "live", "on_hold", "complete"]),
    contractsManagerId: z.string().optional().transform((v) => (v ? v : null)).pipe(uuid.nullable()),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "End date must be after the start date" });

export const accessInput = z
  .object({
    jobId: uuid,
    userIds: z.array(uuid).min(1, "Tick at least one person"),
    scope: z.enum(["all", "areas"]),
    areaIds: z.array(uuid).default([]),
    attendanceFrom: optionalDate,
    attendanceTo: optionalDate,
    note: optionalText(300),
    managerReports: z.boolean().default(false),
  })
  .refine((v) => !v.attendanceFrom || !v.attendanceTo || v.attendanceTo >= v.attendanceFrom, {
    path: ["attendanceTo"], message: "End date must be after the start date",
  });

export const companyInput = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(120),
  trade: optionalText(120),
  contactName: optionalText(120),
  contactPhone: optionalText(40),
  contactEmail: z.string().trim().max(200).optional().transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email"),
});

export const personInput = z.object({
  fullName: z.string().trim().min(2, "Enter the person's name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  phone: optionalText(40),
  jobTitle: optionalText(120),
  companyId: uuid,
  role: z.enum(["admin", "office", "operative", "manager"]),
});

/** Turn zod issues into { field: message } for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
