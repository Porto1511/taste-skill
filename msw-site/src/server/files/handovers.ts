import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { withUser } from "../db";
import { getFileStore, storagePaths } from "../storage";
import { UserError } from "../errors";
import { log } from "../log";
import type { Viewer } from "../auth/viewer";
import { processPhoto } from "./validate";
import type { IncomingFile } from "./uploads";
import { CLIENT_DECLARATION, DAYS, DAYWORK_DECLARATION, HANDOVER_TRADES } from "@/lib/handover";

export const DECLARATION = CLIENT_DECLARATION;

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const email = z.string().trim().max(200).optional().transform((v) => v || null)
  .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email or leave it blank");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the week commencing date");
const dayIds = DAYS.map((d) => d.id) as unknown as [string, ...string[]];

export const handoverInput = z.object({
  jobId: z.string().uuid(),
  areaId: z.string().optional().transform((v) => (v ? v : null)).pipe(z.string().uuid().nullable()),
  scopes: z.array(z.enum(HANDOVER_TRADES.map((t) => t.id) as unknown as [string, ...string[]])).min(1, "Choose what you are handing over: nets, deck or studs"),
  title: z.string().trim().min(3, "Say what is being handed over").max(160),
  details: z.record(z.string(), z.record(z.string(), z.string().max(2000))),
  daysWorked: z.array(z.enum(dayIds)).min(1, "Tick the days worked"),
  weekCommencing: isoDate,
  signerName: z.string().trim().min(2, "The client needs to print their name").max(120),
  signerCompany: z.string().trim().min(2, "Enter the client's company").max(160),
  signerPosition: optText(120),
  signerEmail: email,
}).superRefine((v, ctx) => {
  for (const id of v.scopes) {
    const def = HANDOVER_TRADES.find((t) => t.id === id)!;
    for (const f of def.fields) {
      const val = v.details[id]?.[f.key]?.trim();
      if (f.required && !val) ctx.addIssue({ code: "custom", path: ["details"], message: `${def.long}: enter ${f.label.toLowerCase()}` });
      if (f.numeric && val && !/^\d{1,7}$/.test(val)) ctx.addIssue({ code: "custom", path: ["details"], message: `${def.long}: ${f.label.toLowerCase()} must be a number` });
    }
  }
});

/** Validate a drawn signature: a real PNG that actually contains ink. */
export async function processSignature(bytes: Buffer, who: string): Promise<Buffer> {
  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) throw new UserError(`The ${who} signature could not be read. Please sign again.`);
  try {
    const img = sharp(bytes, { failOn: "error" }).ensureAlpha();
    const { channels } = await img.stats();
    if (!channels[3] || channels[3].max === 0) throw new UserError(`The ${who} signature box is empty.`);
    const meta = await img.metadata();
    if ((meta.width ?? 0) > 3000 || (meta.height ?? 0) > 2000) throw new UserError("The signature image is too large.");
    return await sharp(bytes).ensureAlpha().trim({ threshold: 1 })
      .extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  } catch (err) {
    if (err instanceof UserError) throw err;
    throw new UserError(`The ${who} signature could not be read. Please sign again.`);
  }
}

async function withCleanup<T>(fn: (track: (p: string) => void) => Promise<T>): Promise<T> {
  const written: string[] = [];
  try {
    return await fn((p) => written.push(p));
  } catch (err) {
    if (written.length) await getFileStore().remove(written).catch(() => {});
    throw err;
  }
}

export async function createHandover(
  viewer: Viewer,
  input: z.infer<typeof handoverInput>,
  signatures: { client: IncomingFile; msw: IncomingFile },
  photos: { file: IncomingFile; caption: string | null }[],
) {
  if (photos.length > 8) throw new UserError("Attach up to 8 photos.");
  const clientSig = await processSignature(signatures.client.bytes, "client");
  const mswSig = await processSignature(signatures.msw.bytes, "MSW");
  const processed = await Promise.all(photos.map(async (p, i) => ({ ...(await processPhoto(p.file.bytes, `Photo ${i + 1}`)), caption: p.caption })));
  // Keep only the selected trades' fields.
  const details: Record<string, Record<string, string>> = {};
  for (const id of input.scopes) {
    const def = HANDOVER_TRADES.find((t) => t.id === id)!;
    details[id] = {};
    for (const key of [...def.fields.map((f) => f.key), "notes"]) {
      const val = input.details[id]?.[key]?.trim();
      if (val) details[id][key] = val;
    }
  }
  const store = getFileStore();
  return withCleanup((track) =>
    withUser(viewer.id, async (tx) => {
      const id = randomUUID();
      const sigPath = storagePaths.signature(input.jobId, randomUUID());
      const mswPath = storagePaths.signature(input.jobId, randomUUID());
      await tx.query(
        `insert into handovers (id, job_id, area_id, title, scope, checklist, signer_name, signer_company, signer_position, signer_email,
           declaration, signature_path, msw_signature_path, captured_by, captured_by_name, captured_by_company, scopes, details,
           days_worked, week_commencing)
         values ($1, $2, $3, $4, null, '[]'::jsonb, $5, $6, $7, $8, $9, $10, $11, auth.uid(), '-', '-', $12::text[], $13::jsonb, $14::text[], $15)`,
        [id, input.jobId, input.areaId, input.title, input.signerName, input.signerCompany, input.signerPosition, input.signerEmail,
          DECLARATION, sigPath, mswPath, input.scopes, JSON.stringify(details), input.daysWorked, input.weekCommencing],
      );
      await store.put(sigPath, clientSig, "image/png");
      track(sigPath);
      await store.put(mswPath, mswSig, "image/png");
      track(mswPath);
      for (const p of processed) {
        const photoId = randomUUID();
        const path = storagePaths.photo(input.jobId, photoId);
        await store.put(path, p.data, "image/jpeg");
        track(path);
        await tx.query(
          "insert into handover_photos (id, handover_id, storage_path, caption, file_size, width, height) values ($1,$2,$3,$4,$5,$6,$7)",
          [photoId, id, path, p.caption, p.data.length, p.width, p.height],
        );
      }
      log.info("handover.signed", { handoverId: id, jobId: input.jobId, userId: viewer.id, scopes: input.scopes });
      return { id, jobId: input.jobId };
    }),
  );
}

// ---------------------------------------------------------------------------
// Daywork sheets
// ---------------------------------------------------------------------------
const hours = z.coerce.number().min(0).max(24).multipleOf(0.25);
export const dayworkInput = z.object({
  jobId: z.string().uuid(),
  weekCommencing: isoDate,
  workers: z.array(z.object({
    name: z.string().trim().min(2, "Enter each person's name").max(120),
    trade: z.string().trim().max(80).default(""),
    hours: z.object(Object.fromEntries(DAYS.map((d) => [d.id, hours])) as Record<(typeof DAYS)[number]["id"], typeof hours>),
  })).min(1, "Add at least one person").max(20),
  description: z.string().trim().min(3, "Describe the work").max(4000),
  materials: optText(2000),
  workComplete: z.boolean(),
  clientName: z.string().trim().min(2, "The client needs to print their name").max(120),
  clientCompany: z.string().trim().min(2, "Enter the client's company").max(160),
  clientPosition: optText(120),
  clientEmail: email,
}).refine((v) => v.workers.some((w) => Object.values(w.hours).some((h) => h > 0)), { message: "Enter the hours worked", path: ["workers"] });

export async function createDaywork(viewer: Viewer, input: z.infer<typeof dayworkInput>, signatures: { client: IncomingFile; msw: IncomingFile }) {
  const clientSig = await processSignature(signatures.client.bytes, "client");
  const mswSig = await processSignature(signatures.msw.bytes, "MSW");
  const store = getFileStore();
  return withCleanup((track) =>
    withUser(viewer.id, async (tx) => {
      const id = randomUUID();
      const clientPath = storagePaths.signature(input.jobId, randomUUID());
      const mswPath = storagePaths.signature(input.jobId, randomUUID());
      await tx.query(
        `insert into dayworks (id, job_id, week_commencing, workers, description, materials, work_complete, client_name, client_position,
           client_company, client_email, client_signature_path, msw_signature_path, captured_by, captured_by_name, captured_by_company, captured_by_company_id)
         values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13, auth.uid(), '-', '-', (select company_id from profiles where id = auth.uid()))`,
        [id, input.jobId, input.weekCommencing, JSON.stringify(input.workers), input.description, input.materials, input.workComplete,
          input.clientName, input.clientPosition, input.clientCompany, input.clientEmail, clientPath, mswPath],
      );
      await store.put(clientPath, clientSig, "image/png");
      track(clientPath);
      await store.put(mswPath, mswSig, "image/png");
      track(mswPath);
      log.info("daywork.signed", { dayworkId: id, jobId: input.jobId, userId: viewer.id });
      return { id, jobId: input.jobId };
    }),
  );
}

export { DAYWORK_DECLARATION };

// ---------------------------------------------------------------------------
// Delivery notes
// ---------------------------------------------------------------------------
export const deliveryInput = z.object({
  jobId: z.string().uuid(),
  items: z.array(z.object({
    description: z.string().trim().min(1, "Say what was delivered").max(300),
    quantity: z.string().trim().max(40).default(""),
  })).min(1, "Add what was delivered").max(50),
  deliveredBy: z.string().trim().min(2, "Who delivered it?").max(120),
  vehicleReg: z.string().trim().toUpperCase().max(12).optional().transform((v) => v || null),
  notes: optText(2000),
  receiverName: z.string().trim().min(2, "The receiver needs to print their name").max(120),
  receiverCompany: z.string().trim().min(2, "Enter the receiver's company").max(160),
  receiverPosition: optText(120),
  receiverEmail: email,
});

export async function createDelivery(viewer: Viewer, input: z.infer<typeof deliveryInput>, signatures: { receiver: IncomingFile; driver: IncomingFile }) {
  const receiverSig = await processSignature(signatures.receiver.bytes, "receiver's");
  const driverSig = await processSignature(signatures.driver.bytes, "driver's");
  const store = getFileStore();
  return withCleanup((track) =>
    withUser(viewer.id, async (tx) => {
      const id = randomUUID();
      const receiverPath = storagePaths.signature(input.jobId, randomUUID());
      const driverPath = storagePaths.signature(input.jobId, randomUUID());
      await tx.query(
        `insert into deliveries (id, job_id, items, delivered_by, vehicle_reg, notes, receiver_name, receiver_position, receiver_company,
           receiver_email, receiver_signature_path, driver_signature_path, captured_by, captured_by_name, captured_by_company, captured_by_company_id)
         values ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12, auth.uid(), '-', '-', (select company_id from profiles where id = auth.uid()))`,
        [id, input.jobId, JSON.stringify(input.items), input.deliveredBy, input.vehicleReg, input.notes, input.receiverName,
          input.receiverPosition, input.receiverCompany, input.receiverEmail, receiverPath, driverPath],
      );
      await store.put(receiverPath, receiverSig, "image/png");
      track(receiverPath);
      await store.put(driverPath, driverSig, "image/png");
      track(driverPath);
      log.info("delivery.signed", { deliveryId: id, jobId: input.jobId, userId: viewer.id });
      return { id, jobId: input.jobId };
    }),
  );
}
