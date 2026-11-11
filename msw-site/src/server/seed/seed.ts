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

  await seedExtras(driver, store);

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

// ---------------------------------------------------------------------------
// Timesheets and handovers (also applied to an existing demo database that
// predates these features — idempotent).
// ---------------------------------------------------------------------------
function londonDate(msAgo: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(Date.now() - msAgo));
}

async function makeSignaturePng(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="160">
    <path d="M20 110 C 40 40, 70 40, 75 100 S 110 150, 125 80 C 135 40, 150 60, 150 95 C 152 125, 175 120, 185 85
             C 195 55, 205 70, 210 100 C 215 125, 235 115, 245 90 L 260 60 C 270 100, 280 120, 300 95 C 315 75, 330 70, 345 95
             C 360 120, 385 110, 400 80 M 300 130 C 360 125, 430 120, 500 112"
          fill="none" stroke="#101828" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function seedExtras(driver: Driver, store: FileStore) {
  const existing = await driver.query<{ h: number; t: number }>(
    "select (select count(*)::int from public.handovers) as h, (select count(*)::int from public.timesheets) as t",
  );
  if (existing.rows[0].h > 0 || existing.rows[0].t > 0) return;

  // Timesheets: the last six working days for MSW's own operatives.
  const plan: { user: string; job: string | null; location?: string; reg: string; mode: "driver" | "passenger" }[] = [
    { user: "gareth", job: "bm", reg: "MS21 NET", mode: "driver" },
    { user: "luke", job: "riverside", reg: "MS70 DEK", mode: "driver" },
    { user: "chris", job: null, location: "Yard — preparing stud welding kit for Wharf Street", reg: "MS21 NET", mode: "passenger" },
  ];
  const today = londonDate(0);
  const monday = (() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const workdays: string[] = [];
  for (let back = 1; workdays.length < 6 && back < 14; back++) {
    const d = londonDate(back * DAY);
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) workdays.push(d);
  }
  let i = 0;
  for (const p of plan) {
    for (const d of workdays) {
      i++;
      const thisWeek = d >= monday;
      const query = p.user === "luke" && d === workdays[0];
      const status = query ? "query" : thisWeek ? "submitted" : "approved";
      const outStart = ["05:45", "06:00", "06:10", "05:50"][i % 4];
      const out = { "05:45": "07:15", "06:00": "07:20", "06:10": "07:25", "05:50": "07:10" }[outStart]!;
      const finish = ["16:30", "17:00", "16:45", "17:15"][i % 4];
      const backEnd = { "16:30": "18:05", "17:00": "18:40", "16:45": "18:20", "17:15": "18:55" }[finish]!;
      await runAsSystem(driver, (tx) =>
        tx.query(
          `insert into public.timesheets (user_id, work_date, job_id, location_note, vehicle_reg, travel_mode, travel_out_start, travel_out_end,
             site_start, site_finish, break_minutes, travel_back_start, travel_back_end, mileage, status, office_note, reviewed_by, reviewed_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,'07:30',$9,30,$9,$10,$11,$12,$13,$14,$15)`,
          [userId(p.user), d, p.job ? jobId(p.job) : null, p.location ?? null, p.reg, p.mode, outStart, out, finish, backEnd,
            p.job === "bm" ? 64 : 48, status,
            query ? "Finish time looks early for a pour day — can you check?" : null,
            status === "submitted" ? null : userId("claire"), status === "submitted" ? null : new Date().toISOString()],
        ),
      );
    }
  }

  await patchDemoTimesheets(driver);

  // Handover: Gang A's Level 2 deck, signed by Kingsgate's site manager.
  const handoverId = demoId("handover:bm-l2");
  const sigPath = storagePaths.signature(jobId("bm"), handoverId);
  await store.put(sigPath, await makeSignaturePng(), "image/png");
  const when = 3 * DAY - 5 * 60 * MIN;
  await runAsSystem(driver, (tx) =>
    tx.query(
      `insert into public.handovers (id, job_id, area_id, title, scope, checklist, signer_name, signer_company, signer_position, signer_email,
         declaration, signature_path, captured_by, captured_by_name, captured_by_company, signed_at, created_at, scopes)
       values ($1,$2,$3,$4,$5,$6::jsonb,'Martin Doyle','Kingsgate Construction Ltd','Site Manager',null,$7,$8,$9,'-','-',$10,$10,'{deck,studs}')`,
      [handoverId, jobId("bm"), areaId("bm", "l2"), L2_TITLE, L2_SCOPE, JSON.stringify(L2_CHECKLIST),
        "I confirm that the works described above have been inspected and are accepted as complete, and that the area is handed over from MSW UK Ltd in the condition shown.",
        sigPath, userId("john"), at(when)],
    ), { actorId: userId("john"), at: at(when) },
  );
  for (const [n, scene] of (["deck", "studs"] as const).entries()) {
    const photoId = demoId(`handover:bm-l2:photo:${n}`);
    const img = await makeSamplePhoto(scene, n ? "Level 2 studs complete grid A–C" : "Level 2 deck complete — looking north", 10 + n);
    const path = storagePaths.photo(jobId("bm"), photoId);
    await store.put(path, img, "image/jpeg");
    await runAsSystem(driver, (tx) =>
      tx.query("insert into public.handover_photos (id, handover_id, storage_path, caption, file_size, width, height, created_at) values ($1,$2,$3,$4,$5,1600,1200,$6)",
        [photoId, handoverId, path, null, img.length, at(when)]),
    );
  }
  await patchDemoHandovers(driver, store);
}

const L2_TITLE = "Level 2 — deck & studs handover";
const L2_SCOPE = "Level 2 deck complete grids A–H / 1–6 including edge trims to the north and east elevations. Studs complete throughout.";
const L2_CHECKLIST = [
  { label: "Metal deck laid and fixed to current drawings", checked: true, section: "deck" },
  { label: "Edge trims installed and restrained", checked: true, section: "deck" },
  { label: "Area clear of MSW materials, offcuts and waste", checked: true, section: "deck" },
  { label: "Shear studs complete to the current stud layout", checked: true, section: "studs" },
  { label: "Area clear of MSW materials, offcuts and waste", checked: true, section: "studs" },
];

/**
 * Demo handovers by trade (fictional data). Idempotent; also updates an
 * older hosted demo database: tidies the Level 2 handover and adds a
 * nets-only handover on Level 3.
 */
export async function patchDemoHandovers(driver: Driver, store: FileStore) {
  await runAsSystem(driver, (tx) =>
    tx.query("update public.handovers set title = $2, scope = $3, checklist = $4::jsonb, scopes = '{deck,studs}' where id = $1",
      [demoId("handover:bm-l2"), L2_TITLE, L2_SCOPE, JSON.stringify(L2_CHECKLIST)]),
  );
  const netsId = demoId("handover:bm-l3-nets");
  const exists = await driver.query("select 1 from public.handovers where id = $1", [netsId]);
  if (!exists.rowCount) await insertNetsHandover(driver, store, netsId);
  await patchDemoCertificates(driver, store);
}

async function insertNetsHandover(driver: Driver, store: FileStore, netsId: string) {
  const sigPath = storagePaths.signature(jobId("bm"), netsId);
  await store.put(sigPath, await makeSignaturePng(), "image/png");
  const when = 6 * DAY - 3 * 60 * MIN;
  await runAsSystem(driver, (tx) =>
    tx.query(
      `insert into public.handovers (id, job_id, area_id, title, scope, checklist, signer_name, signer_company, signer_position,
         declaration, signature_path, captured_by, captured_by_name, captured_by_company, signed_at, created_at, scopes)
       values ($1,$2,$3,'Level 3 — nets handover',$4,$5::jsonb,'Martin Doyle','Kingsgate Construction Ltd','Site Manager',$6,$7,$8,'-','-',$9,$9,'{netting}')`,
      [netsId, jobId("bm"), areaId("bm", "l3"),
        "Nets N1–N7 rigged under Level 3, grids A–H. Handed over so decking can start.",
        JSON.stringify([
          { label: "Nets installed to the current netting layout", checked: true, section: "netting" },
          { label: "Nets tied off and inspected", checked: true, section: "netting" },
          { label: "Area clear of MSW materials, offcuts and waste", checked: true, section: "netting" },
        ]),
        "I confirm that the works described above have been inspected and are accepted as complete, and that the area is handed over from MSW UK Ltd in the condition shown.",
        sigPath, userId("liam"), at(when)],
    ), { actorId: userId("liam"), at: at(when) },
  );
  const photoId = demoId("handover:bm-l3-nets:photo:0");
  const img = await makeSamplePhoto("netting", "Level 3 nets N1–N7 rigged", 21);
  const path = storagePaths.photo(jobId("bm"), photoId);
  await store.put(path, img, "image/jpeg");
  await runAsSystem(driver, (tx) =>
    tx.query("insert into public.handover_photos (id, handover_id, storage_path, caption, file_size, width, height, created_at) values ($1,$2,$3,$4,$5,1600,1200,$6)",
      [photoId, netsId, path, "Level 3 nets N1–N7 rigged", img.length, at(when)]),
  );
}

/**
 * Certificate details (paper-form fields), MSW signatures, a daywork sheet
 * and a delivery note for the demo (fictional data). Idempotent.
 */
export async function patchDemoCertificates(driver: Driver, store: FileStore) {
  const weekOf = (back: number) => {
    const d = new Date(`${londonDate(back * DAY)}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const certs = [
    { id: demoId("handover:bm-l2"), back: 3, days: ["mon", "tue", "wed"], details: {
      deck: { area: "Level 2, grids A–H / 1–6 including edge trims to north and east elevations" },
      studs: { floorLevel: "Level 2", totalStuds: "1240", studSize: "19 × 100" },
      notes: { notes: "Decked over riser void at D3 as instructed by site manager — void to be cut out and protected by others." },
    } },
    { id: demoId("handover:bm-l3-nets"), back: 6, days: ["mon", "tue"], details: {
      netting: { gridlines: "Level 3, grids A–H / 1–6", serials: "N1 4471, N2 4472, N3 4473, N4 4474, N5 4475, N6 4476, N7 4477" },
    } },
  ];
  for (const c of certs) {
    const [row] = (await driver.query<{ msw_signature_path: string | null; job_id: string }>(
      "select msw_signature_path, job_id from public.handovers where id = $1", [c.id])).rows;
    if (!row || row.msw_signature_path) continue;
    const path = storagePaths.signature(row.job_id, demoId(`${c.id}:msw-sig`));
    await store.put(path, await makeSignaturePng(), "image/png");
    await runAsSystem(driver, (tx) =>
      tx.query("update public.handovers set details = $2::jsonb, days_worked = $3, week_commencing = $4, msw_signature_path = $5 where id = $1",
        [c.id, JSON.stringify(c.details), c.days, weekOf(c.back), path]));
  }

  const dayworkId = demoId("daywork:bm-standing");
  if (!(await driver.query("select 1 from public.dayworks where id = $1", [dayworkId])).rowCount) {
    const when = 2 * DAY - 4 * 60 * MIN;
    const [client, msw] = [storagePaths.signature(jobId("bm"), demoId("daywork:bm-standing:client")), storagePaths.signature(jobId("bm"), demoId("daywork:bm-standing:msw"))];
    await store.put(client, await makeSignaturePng(), "image/png");
    await store.put(msw, await makeSignaturePng(), "image/png");
    await runAsSystem(driver, (tx) =>
      tx.query(
        `insert into public.dayworks (id, job_id, kind, week_commencing, workers, description, materials, work_complete, client_name, client_position,
           client_company, client_email, client_signature_path, msw_signature_path, captured_by, captured_by_name, captured_by_company, captured_by_company_id, signed_at, created_at)
         values ($1,$2,'standing',$3,$4::jsonb,$5,null,true,'Martin Doyle','Site Manager','Kingsgate Construction Ltd',null,$6,$7,$8,'-','-',$9,$10,$10)`,
        [dayworkId, jobId("bm"), weekOf(2),
          JSON.stringify([
            { name: "Liam Turner", trade: "Edge protection", hours: { mon: 0, tue: 3, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
            { name: "Ryan Hughes", trade: "Netting", hours: { mon: 0, tue: 3, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
          ]),
          "Standing time — crane unavailable 07:30–10:30, could not lift deck bundles to Level 4.",
          client, msw, userId("liam"), "00000000-0000-0000-0000-000000000000", at(when)],
      ), { actorId: userId("liam"), at: at(when) },
    );
  }

  const extraId = demoId("daywork:bm-extra-trims");
  if (!(await driver.query("select 1 from public.dayworks where id = $1", [extraId])).rowCount) {
    const when = 1 * DAY - 2 * 60 * MIN;
    const [client, msw] = [storagePaths.signature(jobId("bm"), demoId("daywork:bm-extra:client")), storagePaths.signature(jobId("bm"), demoId("daywork:bm-extra:msw"))];
    await store.put(client, await makeSignaturePng(), "image/png");
    await store.put(msw, await makeSignaturePng(), "image/png");
    await runAsSystem(driver, (tx) =>
      tx.query(
        `insert into public.dayworks (id, job_id, kind, week_commencing, workers, description, materials, work_complete, client_name, client_position,
           client_company, client_email, client_signature_path, msw_signature_path, captured_by, captured_by_name, captured_by_company, captured_by_company_id, signed_at, created_at)
         values ($1,$2,'extra',$3,$4::jsonb,$5,$6,true,'Martin Doyle','Site Manager','Kingsgate Construction Ltd',null,$7,$8,$9,'-','-',$10,$11,$11)`,
        [extraId, jobId("bm"), weekOf(1),
          JSON.stringify([
            { name: "John Smith", trade: "Decking", hours: { mon: 2, tue: 1.5, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
            { name: "Mark Jones", trade: "Decking", hours: { mon: 2, tue: 1.5, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
          ]),
          "Extra edge trim to new riser opening at D4, instructed by the site manager.", "4 × 3 m edge trim, fixings",
          client, msw, userId("john"), "00000000-0000-0000-0000-000000000000", at(when)],
      ), { actorId: userId("john"), at: at(when) },
    );
  }

  const deliveryId = demoId("delivery:bm-studs");
  if (!(await driver.query("select 1 from public.deliveries where id = $1", [deliveryId])).rowCount) {
    const when = 1 * DAY - 6 * 60 * MIN;
    const [receiver, driverSig] = [storagePaths.signature(jobId("bm"), demoId("delivery:bm-studs:receiver")), storagePaths.signature(jobId("bm"), demoId("delivery:bm-studs:driver"))];
    await store.put(receiver, await makeSignaturePng(), "image/png");
    await store.put(driverSig, await makeSignaturePng(), "image/png");
    await runAsSystem(driver, (tx) =>
      tx.query(
        `insert into public.deliveries (id, job_id, items, delivered_by, vehicle_reg, notes, receiver_name, receiver_position, receiver_company, receiver_email,
           receiver_signature_path, driver_signature_path, captured_by, captured_by_name, captured_by_company, captured_by_company_id, signed_at, created_at)
         values ($1,$2,$3::jsonb,'Gareth Evans','MS21 NET',$4,'Martin Doyle','Site Manager','Kingsgate Construction Ltd',null,$5,$6,$7,'-','-',$8,$9,$9)`,
        [deliveryId, jobId("bm"),
          JSON.stringify([
            { description: "19 × 100 shear studs (boxes)", quantity: "12" },
            { description: "Ceramic ferrules (boxes)", quantity: "12" },
            { description: "Edge trim 150 mm × 3 m", quantity: "40" },
          ]),
          "One box of ferrules damaged in transit — replacement on next drop.",
          receiver, driverSig, userId("gareth"), "00000000-0000-0000-0000-000000000000", at(when)],
      ), { actorId: userId("gareth"), at: at(when) },
    );
  }
}

/**
 * Demo content for multi-job days and "work done" (fictional data only).
 * Idempotent; also brings an older hosted demo database up to date.
 */
export async function patchDemoTimesheets(driver: Driver) {
  await runAsSystem(driver, async (tx) => {
    await tx.query(
      `update public.timesheets set
         work_done = case user_id when $1 then '{netting}'::text[] when $2 then '{deck,studs}'::text[] else '{other}'::text[] end,
         work_description = case user_id
           when $1 then 'Net inspection Levels 1–4, re-tied N4 at grid H'
           when $2 then 'Core A deck laid and pinned, studs to bays 1–4'
           else 'Prepared and PAT-checked stud welding kit for Wharf Street' end
       where work_done = '{}'`,
      [userId("gareth"), userId("luke")],
    );
    await tx.query("update public.timesheets set driven_by = 'Gareth Evans' where user_id = $1 and travel_mode = 'passenger' and driven_by is null",
      [userId("chris")]);
    // Gareth's most recent day: BM in the morning, then the yard for the afternoon.
    const { rows } = await tx.query<{ id: string; work_date: string }>(
      `select id, work_date from public.timesheets where user_id = $1 and job_id = $2 order by work_date desc limit 1`,
      [userId("gareth"), jobId("bm")],
    );
    const day = rows[0];
    if (!day) return;
    const { rows: count } = await tx.query<{ n: number }>(
      "select count(*)::int as n from public.timesheets where user_id = $1 and work_date = $2", [userId("gareth"), day.work_date]);
    if (count[0].n > 1) return;
    await tx.query(
      `update public.timesheets set site_start = null, site_finish = null, break_minutes = 0,
         travel_back_start = '12:30', travel_back_end = null where id = $1`, [day.id]);
    await tx.query(
      `insert into public.timesheets (user_id, work_date, job_id, location_note, vehicle_reg, travel_mode, travel_out_start, travel_out_end,
         site_start, site_finish, break_minutes, travel_back_start, travel_back_end, work_done, work_description, status)
       select user_id, work_date, null, 'Yard — Northampton', vehicle_reg, 'driver', '12:30', '14:10', null, null, 0, '16:30', '16:50',
              '{netting}', 'Unloaded and repacked nets from British Museum Level 2', status
       from public.timesheets where id = $1`, [day.id]);
  });
  // A Saturday on premium time (Luke, Riverside).
  const sat = (() => { const d = new Date(`${londonDate(0)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7 || 7)); return d.toISOString().slice(0, 10); })();
  await runAsSystem(driver, (tx) =>
    tx.query(
      `insert into public.timesheets (user_id, work_date, job_id, vehicle_reg, travel_mode, travel_out_start, travel_out_end,
         travel_back_start, travel_back_end, break_minutes, mileage, work_done, work_description, premium, status)
       select $1, $2::date, $3, 'MS70 DEK', 'driver', '06:00', '07:20', '13:00', '14:20', 0, 48, '{deck}', 'Saturday catch-up: deck bays E1–H6', true, 'submitted'
       where not exists (select 1 from public.timesheets where user_id = $1 and work_date = $2::date)`,
      [userId("luke"), sat, jobId("riverside")]),
  );
}

/** Damian is the only administrator (uploads drawings, creates jobs). Idempotent. */
export async function patchDemoRoles(driver: Driver) {
  await runAsSystem(driver, (tx) =>
    tx.query("update public.profiles set role = 'office' where id = $1 and role = 'admin'", [userId("richard")]));
}
