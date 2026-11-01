/**
 * Seeds the FICTIONAL demonstration environment.
 *
 * Business operations (granting access, approving revisions, responding to
 * reports) go through the same SQL functions the application uses, attributed
 * to the relevant demo user so the activity history reads realistically.
 */
import { randomUUID } from "node:crypto";
import type { Driver, Queryable } from "../db/types";
import { runAsSystem } from "../db/session";
import type { FileStore } from "../storage/types";
import { storagePaths } from "../storage/types";
import { makeDrawingPdf, makeRamsPdf } from "./pdfs";
import { makeSamplePhoto } from "./photos";
import {
  areaId, companyId, demoCompanies, demoDocuments, demoEmail, demoGrants, demoId, demoJobs, demoReports,
  demoUsers, jobId, ramsHazards, userId, type CompanyKey,
} from "./demo-data";

export type CreateAuthUser = (args: { id: string; email: string; password: string }) => Promise<string>;

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function at(msAgo: number) {
  return new Date(Date.now() - msAgo).toISOString();
}
function dateFromToday(days: number) {
  const d = new Date(Date.now() + days * DAY);
  return d.toISOString().slice(0, 10);
}
function ukDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export async function seedDemo(
  driver: Driver,
  store: FileStore,
  createAuthUser: CreateAuthUser,
  password: string,
  log: (msg: string) => void = () => {},
) {
  const existing = await driver.query<{ n: number }>("select count(*)::int as n from public.profiles");
  if (existing.rows[0].n > 0) {
    throw new Error("Database already contains users; refusing to seed. Reset the demo data first.");
  }

  const sys = <T>(fn: (tx: Queryable) => Promise<T>, actor?: string, msAgo?: number) =>
    runAsSystem(driver, fn, { actorId: actor ? userId(actor) : undefined, at: msAgo !== undefined ? at(msAgo) : undefined });

  // Companies -----------------------------------------------------------------
  log("companies");
  await sys(async (tx) => {
    for (const [key, c] of Object.entries(demoCompanies) as [CompanyKey, (typeof demoCompanies)[CompanyKey]][]) {
      await tx.query(
        `insert into public.companies (id, name, is_msw, trade, contact_name, contact_phone, contact_email, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [companyId(key), c.name, Boolean(c.isMsw), c.trade, c.contactName, c.contactPhone, c.contactEmail, at(200 * DAY)],
      );
    }
  }, undefined, 200 * DAY);

  // People ----------------------------------------------------------------------
  log("users");
  for (const u of demoUsers) {
    await createAuthUser({ id: userId(u.key), email: demoEmail(u), password });
  }
  await sys(async (tx) => {
    for (const u of demoUsers) {
      await tx.query(
        `insert into public.profiles (id, company_id, full_name, email, phone, job_title, role, active, invited_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [userId(u.key), companyId(u.company), u.name, demoEmail(u), u.phone, u.title, u.role, u.active ?? true, at(180 * DAY)],
      );
    }
  }, "claire", 180 * DAY);

  // Jobs and areas --------------------------------------------------------------
  log("jobs");
  for (const j of demoJobs) {
    await sys(async (tx) => {
      await tx.query(
        `insert into public.jobs (id, job_number, name, site_address, postcode, directions, main_contractor,
           site_contact_name, site_contact_role, site_contact_phone, start_date, end_date, induction_url,
           induction_notes, site_instructions, status, contracts_manager_id, created_by, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          jobId(j.key), j.number, j.name, j.address, j.postcode, j.directions ?? null, j.mainContractor,
          j.contact.name, j.contact.role, j.contact.phone, dateFromToday(j.startDays), dateFromToday(j.endDays),
          j.inductionUrl ?? null, j.inductionNotes ?? null, j.instructions ?? null, j.status,
          userId(j.contractsManager), userId("claire"), at(j.createdDaysAgo * DAY),
        ],
      );
      let order = 0;
      for (const a of j.areas) {
        await tx.query(
          `insert into public.job_areas (id, job_id, name, kind, sort_order, created_at) values ($1,$2,$3,$4,$5,$6)`,
          [areaId(j.key, a.key), jobId(j.key), a.name, a.kind, order++, at(j.createdDaysAgo * DAY)],
        );
      }
    }, "claire", j.createdDaysAgo * DAY);
  }

  // Documents and revisions -----------------------------------------------------
  log("documents");
  for (const d of demoDocuments) {
    const job = demoJobs.find((j) => j.key === d.job)!;
    const docId = demoId(`doc:${d.key}`);
    const firstDays = Math.max(...d.revisions.map((r) => r.daysAgo));
    await sys(async (tx) => {
      await tx.query(
        `insert into public.documents (id, job_id, kind, doc_number, title, created_by, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [docId, jobId(d.job), d.kind, d.number, d.title, userId("sam"), at(firstDays * DAY + 10 * MIN)],
      );
      if (d.areas.length) {
        await tx.query("select public.set_document_areas($1, $2::uuid[])", [docId, d.areas.map((a) => areaId(d.job, a))]);
      }
    }, "sam", firstDays * DAY + 10 * MIN);

    const history: { rev: string; date: string; note: string }[] = [];
    for (const r of d.revisions) {
      const revId = demoId(`rev:${d.key}:${r.rev}`);
      const uploaded = at(r.daysAgo * DAY);
      history.push({ rev: r.rev, date: ukDate(uploaded), note: r.note });
      const areaLabel = d.areas.length
        ? d.areas.map((a) => job.areas.find((x) => x.key === a)!.name).join(" & ")
        : "All areas";
      const pdf =
        d.kind === "drawing"
          ? await makeDrawingPdf({
              projectName: job.name, jobNumber: job.number, mainContractor: job.mainContractor,
              docNumber: d.number, title: d.title, revision: r.rev,
              status: r.final === "approved" ? "approved" : r.final === "superseded" ? "superseded" : "draft",
              date: ukDate(uploaded), areaLabel, style: d.style ?? "deck", history: [...history],
              variant: d.number.length + r.rev.charCodeAt(r.rev.length - 1),
            })
          : await makeRamsPdf({
              projectName: job.name, jobNumber: job.number, mainContractor: job.mainContractor,
              reference: d.number, title: d.title, revision: r.rev, date: ukDate(uploaded),
              activity: d.activity ?? d.title,
              hazards: [
                ...ramsHazards.default,
                ...(/stud/i.test(d.title) ? ramsHazards.stud : []),
                ...(/concrete/i.test(d.title) ? ramsHazards.concrete : []),
              ],
              sequence: [
                "Confirm allocated work area with the MSW supervisor and check the current drawing revision in MSW Site.",
                "Check nets / edge protection are in place and inspection tags signed before starting.",
                "Receive materials by crane to the agreed landing position; check delivery against drawing schedule.",
                "Carry out the works in the sequence shown on the approved drawings, keeping leading edges protected.",
                "Inspect completed work, clear the area of offcuts and fixings, and record progress in MSW Site.",
              ],
              ppe: ["Hard hat", "Safety boots (S3)", "High-visibility vest", "Cut-resistant gloves", "Safety glasses", "Hearing protection where signed"],
            });
      const path = storagePaths.revision(jobId(d.job), revId);
      await store.put(path, pdf, "application/pdf");
      const fileName = `${d.number}_rev${r.rev}.pdf`;
      await sys(async (tx) => {
        await tx.query(
          `insert into public.document_revisions (id, document_id, revision, status, change_note, storage_path,
             file_name, file_size, mime_type, uploaded_by, uploaded_at)
           values ($1,$2,$3,'draft',$4,$5,$6,$7,'application/pdf',$8,$9)`,
          [revId, docId, r.rev, r.note, path, fileName, pdf.length, userId("sam"), uploaded],
        );
      }, "sam", r.daysAgo * DAY);
      if (r.final === "approved" || r.final === "superseded") {
        await sys((tx) => tx.query("select public.approve_revision($1)", [revId]), "claire", r.daysAgo * DAY - 40 * MIN);
      } else if (r.final === "withdrawn") {
        await sys((tx) => tx.query("select public.withdraw_revision($1)", [revId]), "claire", r.daysAgo * DAY - 40 * MIN);
      }
    }
  }

  // Access ----------------------------------------------------------------------
  log("access");
  for (const g of demoGrants) {
    await sys(
      (tx) =>
        tx.query("select public.grant_job_access($1, $2::uuid[], $3, $4::uuid[], $5, $6, $7, $8)", [
          jobId(g.job),
          g.users.map(userId),
          Boolean(g.allAreas),
          (g.areas ?? []).map((a) => areaId(g.job, a)),
          g.fromDays !== undefined ? dateFromToday(g.fromDays) : null,
          g.toDays !== undefined ? dateFromToday(g.toDays) : null,
          g.note ?? null,
          Boolean(g.managerReports),
        ]),
      "claire",
      g.daysAgo * DAY,
    );
    if (g.revokeDaysAgo !== undefined) {
      await sys(
        (tx) =>
          tx.query(
            `select public.revoke_job_access(array(
               select id from public.job_assignments
               where job_id = $1 and user_id = any($2::uuid[]) and revoked_at is null))`,
            [jobId(g.job), g.users.map(userId)],
          ),
        "claire",
        g.revokeDaysAgo * DAY,
      );
    }
  }

  // Reports, photos and responses --------------------------------------------
  log("reports");
  let photoVariant = 0;
  for (const r of demoReports) {
    const reportId = demoId(`report:${r.key}`);
    const created = r.minutesAgo * MIN;
    await sys(async (tx) => {
      await tx.query(
        `insert into public.reports (id, job_id, area_id, kind, category, priority, title, description, status,
           shared_with_team, author_id, author_name, author_company_id, author_company_name, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'-',$12,'-',$13,$13)`,
        [
          reportId, jobId(r.job), r.area ? areaId(r.job, r.area) : null, r.kind, r.category ?? null,
          r.priority ?? "normal", r.title, r.description, r.kind === "issue" ? "open" : null, Boolean(r.shared),
          userId(r.author), companyId(demoUsers.find((u) => u.key === r.author)!.company), at(created),
        ],
      );
    }, r.author, created);

    for (const p of r.photos) {
      const photoId = randomUUID();
      const img = await makeSamplePhoto(p.scene, p.caption, photoVariant++);
      const path = storagePaths.photo(jobId(r.job), photoId);
      await store.put(path, img, "image/jpeg");
      await sys((tx) =>
        tx.query(
          `insert into public.report_photos (id, report_id, storage_path, caption, mime_type, file_size, width, height, uploaded_by, created_at)
           values ($1,$2,$3,$4,'image/jpeg',$5,1600,1200,$6,$7)`,
          [photoId, reportId, path, p.caption, img.length, userId(r.author), at(created)],
        ),
      );
    }

    for (const resp of r.responses) {
      const when = created - resp.minutesAfter * MIN;
      await sys(
        (tx) => tx.query("select public.respond_to_report($1, $2, $3::public.report_status)", [reportId, resp.body ?? null, resp.status ?? null]),
        resp.author,
        Math.max(when, 60_000),
      );
    }
  }

  // Older notifications are marked read so the demo inbox looks lived-in.
  await sys((tx) => tx.query("update public.notifications set read_at = created_at + interval '2 hours' where created_at < now() - interval '2 days'"));

  const counts = await driver.query<{ jobs: number; users: number; revisions: number; reports: number }>(
    `select (select count(*)::int from public.jobs) as jobs,
            (select count(*)::int from public.profiles) as users,
            (select count(*)::int from public.document_revisions) as revisions,
            (select count(*)::int from public.reports) as reports`,
  );
  return counts.rows[0];
}
