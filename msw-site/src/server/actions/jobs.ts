"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff } from "../auth/viewer";
import { withUser } from "../db";
import { fieldErrors, jobInput } from "../validation";
import { attempt, str } from "./helpers";
import type { ActionState } from "@/lib/action-state";

function readJob(f: FormData) {
  return jobInput.safeParse({
    jobNumber: str(f, "jobNumber"), name: str(f, "name"), siteAddress: str(f, "siteAddress"), postcode: str(f, "postcode"),
    what3words: str(f, "what3words"), directions: str(f, "directions"), mainContractor: str(f, "mainContractor"),
    siteContactName: str(f, "siteContactName"), siteContactRole: str(f, "siteContactRole"), siteContactPhone: str(f, "siteContactPhone"),
    startDate: str(f, "startDate"), endDate: str(f, "endDate"), inductionUrl: str(f, "inductionUrl"), inductionNotes: str(f, "inductionNotes"),
    siteInstructions: str(f, "siteInstructions"), status: str(f, "status") ?? "planned", contractsManagerId: str(f, "contractsManagerId"),
  });
}

const columns = `job_number, name, site_address, postcode, what3words, directions, main_contractor, site_contact_name,
  site_contact_role, site_contact_phone, start_date, end_date, induction_url, induction_notes, site_instructions, status, contracts_manager_id`;

function values(j: z.infer<typeof jobInput>) {
  return [j.jobNumber.toUpperCase(), j.name, j.siteAddress, j.postcode?.toUpperCase() ?? null, j.what3words, j.directions, j.mainContractor,
    j.siteContactName, j.siteContactRole, j.siteContactPhone, j.startDate, j.endDate, j.inductionUrl, j.inductionNotes, j.siteInstructions,
    j.status, j.contractsManagerId];
}

export async function createJobAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const parsed = readJob(f);
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  let id = "";
  const res = await attempt("jobs.create", async () => {
    id = await withUser(viewer.id, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into jobs (${columns}, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, auth.uid()) returning id`,
        values(parsed.data),
      );
      // Sensible starting areas can be added straight away from the job page.
      return rows[0].id;
    });
    return { ok: true };
  });
  if (res.error) return res;
  redirect(`/office/jobs/${id}?created=1`);
}

export async function updateJobAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const jobId = z.string().uuid().parse(str(f, "jobId"));
  const parsed = readJob(f);
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return attempt("jobs.update", async () => {
    await withUser(viewer.id, (tx) =>
      tx.query(
        `update jobs set (${columns}) = ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) where id = $18`,
        [...values(parsed.data), jobId],
      ),
    );
    refresh();
    return { ok: true, message: "Job details saved. People on this job are notified if site information changed.", nonce: Date.now() };
  });
}

const areaSchema = z.object({
  jobId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name, e.g. Level 1").max(80),
  kind: z.enum(["floor", "phase", "zone", "area"]),
});

export async function addAreaAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const parsed = areaSchema.safeParse({ jobId: str(f, "jobId"), name: str(f, "name"), kind: str(f, "kind") ?? "floor" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return attempt("areas.add", async () => {
    await withUser(viewer.id, (tx) =>
      tx.query(
        `insert into job_areas (job_id, name, kind, sort_order)
         values ($1, $2, $3, coalesce((select max(sort_order) + 1 from job_areas where job_id = $1), 0))`,
        [parsed.data.jobId, parsed.data.name, parsed.data.kind],
      ),
    );
    refresh();
    return { ok: true, message: `${parsed.data.name} added.`, nonce: Date.now() };
  });
}

export async function renameAreaAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const id = z.string().uuid().parse(str(f, "areaId"));
  const name = z.string().trim().min(1).max(80).safeParse(str(f, "name"));
  if (!name.success) return { error: "Enter a name." };
  return attempt("areas.rename", async () => {
    await withUser(viewer.id, (tx) => tx.query("update job_areas set name = $1 where id = $2", [name.data, id]));
    refresh();
    return { ok: true, nonce: Date.now() };
  });
}

export async function deleteAreaAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const id = z.string().uuid().parse(str(f, "areaId"));
  return attempt("areas.delete", async () => {
    const n = await withUser(viewer.id, async (tx) => (await tx.query("delete from job_areas where id = $1", [id])).rowCount);
    if (!n) return { error: "Area not found." };
    refresh();
    return { ok: true, message: "Area removed.", nonce: Date.now() };
  });
}

export async function moveAreaAction(f: FormData) {
  const viewer = await requireStaff();
  const id = z.string().uuid().parse(str(f, "areaId"));
  const dir = str(f, "dir") === "up" ? -1 : 1;
  await withUser(viewer.id, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      "select id from job_areas where job_id = (select job_id from job_areas where id = $1) order by sort_order, name",
      [id],
    );
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (let k = 0; k < ids.length; k++) await tx.query("update job_areas set sort_order = $1 where id = $2", [k, ids[k]]);
  });
  refresh();
}
