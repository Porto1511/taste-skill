/**
 * Database-level permission tests.  These run the real Supabase migrations
 * (schema, RLS policies, triggers and functions) in embedded Postgres and
 * query as each demo user under the `authenticated` role — the same way both
 * the application and Supabase's REST API execute requests.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Driver } from "@/server/db/types";
import { asUser, createSeededDb, ids, system } from "./support/db";
import { demoId } from "@/server/seed/demo-data";

let db: Driver;

beforeAll(async () => {
  ({ driver: db } = await createSeededDb());
});

const jobNumbers = async (key: string) =>
  (await asUser(db, key).query<{ job_number: string }>("select job_number from jobs order by job_number")).map(
    (r) => r.job_number,
  );

describe("job visibility — individual allocation only", () => {
  it("John and Mark (allocated) see the British Museum job", async () => {
    expect(await jobNumbers("john")).toEqual(["MSW-2611"]);
    expect(await jobNumbers("mark")).toEqual(["MSW-2611"]);
  });

  it("Paul and Steve (same company, not allocated) cannot see it", async () => {
    for (const key of ["paul", "steve"]) {
      const jobs = await jobNumbers(key);
      expect(jobs).not.toContain("MSW-2611");
      expect(jobs).toEqual(["MSW-2604"]);
      const direct = await asUser(db, key).query("select id from jobs where id = $1", [ids.job("bm")]);
      expect(direct).toHaveLength(0);
    }
  });

  it("company membership alone grants nothing (unallocated operative sees no jobs)", async () => {
    // Kieran's access was revoked; Danny is deactivated; Sarah (manager) was never granted.
    expect(await jobNumbers("kieran")).toEqual([]);
    expect(await jobNumbers("danny")).toEqual([]);
    expect(await jobNumbers("sarah")).toEqual([]);
  });

  it("another subcontractor cannot see ABC Decking's other jobs", async () => {
    // Liam (Northern Edge) works on BM but must never see Riverside, where ABC's second gang is.
    expect(await jobNumbers("liam")).toEqual(["MSW-2611"]);
    const riverside = await asUser(db, "liam").query("select * from reports where job_id = $1", [ids.job("riverside")]);
    expect(riverside).toHaveLength(0);
  });

  it("a subcontractor owner does not automatically see every job involving their employees", async () => {
    // Dave (ABC director) is granted BM only — not Riverside where Paul and Steve work.
    expect(await jobNumbers("dave")).toEqual(["MSW-2611"]);
  });

  it("MSW office users see every job", async () => {
    expect((await jobNumbers("claire")).length).toBe(6);
    expect((await jobNumbers("sam")).length).toBe(6);
  });

  it("completed jobs disappear once access is revoked, while history is kept", async () => {
    expect(await jobNumbers("john")).not.toContain("MSW-2552");
    const history = await system(db)(
      "select revoked_at from job_assignments where job_id = $1 and user_id = $2",
      [ids.job("stannes"), ids.user("john")],
    );
    expect(history).toHaveLength(1);
    expect(history[0].revoked_at).not.toBeNull();
  });
});

describe("floor / phase restrictions on the same job", () => {
  const visibleDocs = async (key: string) =>
    (
      await asUser(db, key).query<{ doc_number: string }>(
        `select d.doc_number from documents d
         join document_revisions r on r.document_id = d.id and r.status = 'approved'
         where d.job_id = $1 order by d.doc_number`,
        [ids.job("bm")],
      )
    ).map((r) => r.doc_number);

  it("Gang A (Levels 1 & 2) sees only Level 1/2 and job-wide documents", async () => {
    const docs = await visibleDocs("john");
    expect(docs).toEqual([
      "MSW-2611-DK-101", "MSW-2611-DK-102", "MSW-2611-ET-401", "MSW-2611-GA-001", "MSW-2611-ST-301",
      "RAMS-2611-01", "RAMS-2611-03",
    ]);
    expect(docs).not.toContain("MSW-2611-DK-103");
    expect(docs).not.toContain("MSW-2611-SN-201");
  });

  it("Gang B (Levels 3 & 4) sees only Level 3/4 and job-wide documents", async () => {
    const docs = await visibleDocs("liam");
    expect(docs).toEqual([
      "MSW-2611-DK-103", "MSW-2611-ET-401", "MSW-2611-GA-001", "MSW-2611-SN-201", "RAMS-2611-01", "RAMS-2611-02",
    ]);
    expect(docs).not.toContain("MSW-2611-DK-101");
  });

  it("areas are filtered too: operatives only see their allocated floors", async () => {
    const areas = async (key: string) =>
      (await asUser(db, key).query<{ name: string }>("select name from job_areas where job_id = $1 order by sort_order", [ids.job("bm")])).map((r) => r.name);
    expect(await areas("john")).toEqual(["Level 1", "Level 2"]);
    expect(await areas("liam")).toEqual(["Level 3", "Level 4"]);
    expect(await areas("gareth")).toEqual(["Level 1", "Level 2", "Level 3", "Level 4", "Roof"]);
  });

  it("an operative cannot fetch an out-of-area document by id", async () => {
    const rows = await asUser(db, "john").query("select * from documents where id = $1", [ids.doc("bm-sn")]);
    expect(rows).toHaveLength(0);
    const revs = await asUser(db, "john").query("select * from document_revisions where id = $1", [ids.rev("bm-sn", "B")]);
    expect(revs).toHaveLength(0);
  });
});

describe("document approval status", () => {
  it("draft and superseded revisions are invisible outside the office", async () => {
    const revs = await asUser(db, "john").query<{ revision: string; status: string }>(
      "select revision, status from document_revisions where document_id = $1",
      [ids.doc("bm-dk1")],
    );
    expect(revs).toEqual([{ revision: "C02", status: "approved" }]);

    const draft = await asUser(db, "liam").query("select * from document_revisions where id = $1", [ids.rev("bm-dk3", "C02")]);
    expect(draft).toHaveLength(0);
  });

  it("office staff retain superseded and draft revisions", async () => {
    const revs = await asUser(db, "sam").query<{ revision: string }>(
      "select revision from document_revisions where document_id = $1 order by revision",
      [ids.doc("bm-ga")],
    );
    expect(revs.map((r) => r.revision)).toEqual(["C01", "C02", "C03"]);
  });

  it("only one revision per document can be approved", async () => {
    const counts = await system(db)<{ n: number }>(
      "select max(c)::int as n from (select count(*) c from document_revisions where status = 'approved' group by document_id) x",
    );
    expect(counts[0].n).toBe(1);
  });

  it("approving a new revision supersedes the old one and notifies only users who can see it", async () => {
    await asUser(db, "sam").query("select public.approve_revision($1)", [ids.rev("bm-dk3", "C02")]);
    const statuses = await system(db)<{ revision: string; status: string }>(
      "select revision, status from document_revisions where document_id = $1 order by revision",
      [ids.doc("bm-dk3")],
    );
    expect(statuses).toEqual([
      { revision: "C01", status: "superseded" },
      { revision: "C02", status: "approved" },
    ]);
    const notified = await system(db)<{ full_name: string }>(
      `select p.full_name from notifications n join profiles p on p.id = n.user_id
       where n.kind = 'document.updated' and n.title like '%DK-103 now rev C02%' order by p.full_name`,
    );
    // Level 3 users (Gang B + supervisor) — not Gang A, not Kieran (revoked), not the approver.
    expect(notified.map((n) => n.full_name)).toEqual(["Gareth Evans", "Liam Turner", "Ryan Hughes"]);
  });

  it("operatives cannot approve, upload or alter documents", async () => {
    await expect(asUser(db, "john").query("select public.approve_revision($1)", [ids.rev("bm-dk4", "P01")])).rejects.toMatchObject({ code: "42501" });
    await expect(
      asUser(db, "john").query("update document_revisions set status = 'approved' where id = $1 returning id", [ids.rev("bm-dk4", "P01")]),
    ).resolves.toHaveLength(0);
    await expect(
      asUser(db, "john").query(
        "insert into documents (job_id, kind, doc_number, title) values ($1, 'drawing', 'X-1', 'Fake')",
        [ids.job("bm")],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("access management is admin-only and auditable", () => {
  it("operatives, managers and office (non-admin) users cannot grant access", async () => {
    for (const key of ["john", "dave", "sam"]) {
      await expect(
        asUser(db, key).query("select public.grant_job_access($1, $2::uuid[], true)", [ids.job("bm"), [ids.user("paul")]]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asUser(db, key).query("insert into job_assignments (job_id, user_id, all_areas) values ($1, $2, true)", [ids.job("bm"), ids.user("paul")]),
      ).rejects.toMatchObject({ code: "42501" });
    }
    expect(await jobNumbers("paul")).not.toContain("MSW-2611");
  });

  it("an admin grants several operatives from one company in one action, with areas", async () => {
    const n = await asUser(db, "claire").query<{ grant_job_access: number }>(
      "select public.grant_job_access($1, $2::uuid[], false, $3::uuid[], null, null, 'Weekend cover')",
      [ids.job("northgate"), [ids.user("paul"), ids.user("steve")], [ids.area("northgate", "d3")]],
    );
    expect(n[0].grant_job_access).toBe(2);
    expect(await jobNumbers("paul")).toEqual(["MSW-2598", "MSW-2604"]);
    const areas = await asUser(db, "steve").query<{ name: string }>("select name from job_areas where job_id = $1", [ids.job("northgate")]);
    expect(areas.map((a) => a.name)).toEqual(["Deck 3"]);
  });

  it("changing a gang's areas updates in place without duplicating assignments", async () => {
    await asUser(db, "claire").query(
      "select public.grant_job_access($1, $2::uuid[], false, $3::uuid[])",
      [ids.job("northgate"), [ids.user("paul")], [ids.area("northgate", "d1"), ids.area("northgate", "d2")]],
    );
    const rows = await system(db)(
      "select id from job_assignments where job_id = $1 and user_id = $2 and revoked_at is null",
      [ids.job("northgate"), ids.user("paul")],
    );
    expect(rows).toHaveLength(1);
    const areas = await asUser(db, "paul").query<{ name: string }>("select name from job_areas where job_id = $1 order by sort_order", [ids.job("northgate")]);
    expect(areas.map((a) => a.name)).toEqual(["Deck 1", "Deck 2"]);
  });

  it("revoking access takes effect immediately and is logged with the final areas", async () => {
    const [a] = await system(db)<{ id: string }>(
      "select id from job_assignments where job_id = $1 and user_id = $2 and revoked_at is null",
      [ids.job("northgate"), ids.user("steve")],
    );
    await asUser(db, "claire").query("select public.revoke_job_access($1::uuid[])", [[a.id]]);
    expect(await jobNumbers("steve")).toEqual(["MSW-2604"]);
    const log = await asUser(db, "claire").query<{ action: string; summary: string; actor_name: string }>(
      "select action, summary, actor_name from activity_log where entity_id = $1 order by id",
      [a.id],
    );
    expect(log.map((l) => l.action)).toEqual(["access.granted", "access.revoked"]);
    expect(log[0].summary).toContain("Deck 3");
    expect(log[1].actor_name).toBe("Claire Morgan");
  });

  it("deactivating a user suspends all their access", async () => {
    await asUser(db, "claire").query("update profiles set active = false where id = $1", [ids.user("mark")]);
    expect(await jobNumbers("mark")).toEqual([]);
    await asUser(db, "claire").query("update profiles set active = true where id = $1", [ids.user("mark")]);
    expect(await jobNumbers("mark")).toEqual(["MSW-2611"]);
  });

  it("operatives cannot read the directory, the audit log or other people's notifications", async () => {
    const people = await asUser(db, "john").query("select id from profiles");
    expect(people).toEqual([{ id: ids.user("john") }]);
    expect(await asUser(db, "john").query("select * from activity_log")).toHaveLength(0);
    const notes = await asUser(db, "john").query<{ user_id: string }>("select user_id from notifications");
    expect(notes.every((n) => n.user_id === ids.user("john"))).toBe(true);
    const companies = await asUser(db, "john").query<{ name: string }>("select name from companies");
    expect(companies.map((c) => c.name)).toEqual(["ABC Decking Ltd"]);
  });

  it("operatives cannot escalate their own role", async () => {
    const res = await asUser(db, "john").query("update profiles set role = 'admin' where id = $1 returning id", [ids.user("john")]);
    expect(res).toHaveLength(0);
    const [p] = await system(db)<{ role: string }>("select role from profiles where id = $1", [ids.user("john")]);
    expect(p.role).toBe("operative");
  });
});

describe("site reports", () => {
  it("records the authenticated author and server time, ignoring spoofed values", async () => {
    const [r] = await asUser(db, "john").query<{ author_id: string; author_name: string; created_at: string; status: string; shared_with_team: boolean }>(
      `insert into reports (job_id, area_id, kind, category, title, author_id, author_name, author_company_id,
         author_company_name, created_at, status, shared_with_team)
       values ($1, $2, 'issue', 'materials', 'Damaged sheets in bundle 9', $3, 'Someone Else', $4, 'Fake Ltd',
         '2001-01-01', 'resolved', true)
       returning author_id, author_name, created_at, status, shared_with_team`,
      [ids.job("bm"), ids.area("bm", "l1"), ids.user("john"), ids.user("claire")],
    );
    expect(r.author_name).toBe("John Smith");
    expect(r.status).toBe("open");
    expect(r.shared_with_team).toBe(false);
    expect(Math.abs(Date.parse(r.created_at) - Date.now())).toBeLessThan(60_000);
  });

  it("cannot submit a report as another user (author is always the caller)", async () => {
    const [r] = await asUser(db, "john").query<{ author_id: string; author_name: string }>(
      `insert into reports (job_id, kind, category, title, author_id, author_name, author_company_id, author_company_name)
       values ($1, 'issue', 'other', 'Spoof attempt', $2, 'Mark Jones', $3, 'ABC Decking Ltd')
       returning author_id, author_name`,
      [ids.job("bm"), ids.user("mark"), demoId("company:abc")],
    );
    expect(r.author_id).toBe(ids.user("john"));
    expect(r.author_name).toBe("John Smith");
  });

  it("cannot report on an unallocated job or outside allocated areas", async () => {
    const insert = (key: string, job: string, area: string | null) =>
      asUser(db, key).query(
        `insert into reports (job_id, area_id, kind, category, title, author_id, author_name, author_company_id, author_company_name)
         select $1, $2, 'issue', 'other', 'Test report', id, 'x', company_id, 'x' from profiles where id = auth.uid()`,
        [ids.job(job), area ? ids.area(job, area) : null],
      );
    await expect(insert("paul", "bm", null)).rejects.toMatchObject({ code: "42501" });
    await expect(insert("john", "bm", "l3")).rejects.toMatchObject({ code: "42501" });
  });

  it("operatives see their own reports, not colleagues' unshared reports", async () => {
    const titles = async (key: string) =>
      (await asUser(db, key).query<{ title: string }>("select title from reports order by title")).map((r) => r.title);
    const mark = await titles("mark");
    expect(mark).toContain("Level 1 bays A1–D3 decked and pinned");
    expect(mark).not.toContain("Edge protection missing at grid C4, Level 2"); // John's
    expect(mark).toContain("Level 2 deck completion — record photos"); // shared with Level 2 team
    const liam = await titles("liam");
    expect(liam).not.toContain("Level 2 deck completion — record photos"); // shared, but Level 2 only
  });

  it("subcontractor managers see their company's reports only where explicitly granted", async () => {
    const dave = await asUser(db, "dave").query<{ author_company_name: string; job_id: string }>(
      "select author_company_name, job_id from reports",
    );
    expect(dave.length).toBeGreaterThan(0);
    expect(dave.every((r) => r.author_company_name === "ABC Decking Ltd" && r.job_id === ids.job("bm"))).toBe(true);
    // Paul's Riverside report is ABC's, but Dave has no grant on Riverside.
    const paulReport = await asUser(db, "dave").query("select * from reports where id = $1", [ids.report("rq-short")]);
    expect(paulReport).toHaveLength(0);
    // Sarah (Northern Edge) has no grant at all.
    expect(await asUser(db, "sarah").query("select * from reports")).toHaveLength(0);
  });

  it("only MSW office users change status; authors can reply; report content is immutable", async () => {
    const id = ids.report("bm-hoist");
    await expect(asUser(db, "liam").query("select public.respond_to_report($1, null, 'resolved')", [id])).rejects.toMatchObject({ code: "42501" });
    await asUser(db, "liam").query("select public.respond_to_report($1, 'Engineer now on site', null)", [id]);
    await expect(asUser(db, "ryan").query("select public.respond_to_report($1, 'me too', null)", [id])).rejects.toBeTruthy();
    await asUser(db, "claire").query("select public.respond_to_report($1, 'Hoist back in service 10:15', 'resolved')", [id]);
    await asUser(db, "claire").query("update reports set title = 'Changed', description = 'Rewritten' where id = $1", [id]);
    const [r] = await system(db)<{ status: string; title: string; resolved_at: string | null }>(
      "select status, title, resolved_at from reports where id = $1",
      [id],
    );
    expect(r.status).toBe("resolved");
    expect(r.title).toBe("Hoist out of service — no access to Level 3");
    expect(r.resolved_at).not.toBeNull();
    const liamNotes = await asUser(db, "liam").query<{ title: string }>("select title from notifications where title like '%Hoist%'");
    expect(liamNotes.map((n) => n.title)).toContain("MSW replied and marked resolved: Hoist out of service — no access to Level 3");
  });

  it("photos inherit report visibility", async () => {
    const john = await asUser(db, "john").query("select p.id from report_photos p join reports r on r.id = p.report_id where r.id = $1", [ids.report("bm-edge")]);
    expect(john.length).toBe(1);
    const liam = await asUser(db, "liam").query("select p.id from report_photos p where p.report_id = $1", [ids.report("bm-edge")]);
    expect(liam).toHaveLength(0);
  });
});

describe("audit trail integrity", () => {
  it("API users cannot write, edit or delete activity history", async () => {
    await expect(
      asUser(db, "claire").query("insert into activity_log (action, entity_type, summary) values ('x', 'x', 'forged')"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, "claire").query("delete from activity_log")).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, "claire").query("update activity_log set summary = 'x'")).rejects.toMatchObject({ code: "42501" });
  });

  it("anonymous role has no table access at all", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query("set local role anon");
        return tx.query("select * from jobs");
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("internal helper functions that take a user id are not callable by API users", async () => {
    await expect(
      asUser(db, "paul").query("select app.user_has_job_access($1, $2)", [ids.user("john"), ids.job("bm")]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
