/**
 * Subcontractor invoices are the only money in the app: the MSW office and the
 * boss of the company that sent it see one.  Nobody else — not that company's
 * own lads, not another company.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Driver } from "@/server/db/types";
import { setDriverForTesting } from "@/server/db";
import { setFileStoreForTesting } from "@/server/storage";
import { uploadInvoice } from "@/server/files/invoices";
import { serveInvoice } from "@/server/files/serve";
import type { Viewer } from "@/server/auth/viewer";
import { asUser, createSeededDb, ids, system, type createMemoryStore } from "./support/db";

let db: Driver;
let store: ReturnType<typeof createMemoryStore>;
let derby = "";
let sos = "";
beforeAll(async () => {
  ({ driver: db, store } = await createSeededDb()); setDriverForTesting(db); setFileStoreForTesting(store);
  derby = (await system(db)<{ id: string }>("select id from companies where name = 'Derby Decking'"))[0].id;
  sos = (await system(db)<{ id: string }>("select id from companies where name = 'SOS'"))[0].id;
});

const boss = (key: string, companyId: string): Viewer => ({
  id: ids.user(key), fullName: key, email: "", role: "manager", jobTitle: null, companyId, companyName: "",
  isMswEmployee: false, isStaff: false, isAdmin: false, keepsTimesheet: false, canSiteVisit: false, isBoss: true, unreadNotifications: 0,
});
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
const input = (job: string, n: string) => ({ jobId: ids.job(job), invoiceNumber: n, invoiceDate: "2026-11-20", amount: 4250.5, notes: null });

describe("subcontractor invoices", () => {
  let invoiceId = "";

  it("only the office and that company's boss can see an invoice — never lads, never another company", async () => {
    ({ id: invoiceId } = await uploadInvoice(boss("dave", derby), input("bm", "DD-1001"), { name: "inv.pdf", bytes: pdf }));
    const sees = async (k: string) => (await asUser(db, k).query("select id, amount from subcontractor_invoices")).length;
    expect(await sees("dave")).toBe(1);
    expect(await sees("claire")).toBe(1); // admin
    expect(await sees("pete")).toBe(1); // QS
    expect(await sees("john")).toBe(0); // Derby Decking's own lad
    expect(await sees("mark")).toBe(0);
    expect(await sees("sarah")).toBe(0); // another company's boss
    expect(await sees("liam")).toBe(0);
    expect(await sees("gareth")).toBe(0); // an MSW lad
    expect((await serveInvoice(ids.user("dave"), invoiceId, false)).status).toBe(200);
    expect((await serveInvoice(ids.user("pete"), invoiceId, false)).status).toBe(200);
    expect((await serveInvoice(ids.user("john"), invoiceId, false)).status).toBe(404);
    expect((await serveInvoice(ids.user("sarah"), invoiceId, false)).status).toBe(404);
  });

  it("no amount leaks through alerts or job activity to anyone else", async () => {
    const leaks = await system(db)<{ user_id: string }>(
      `select n.user_id from notifications n join profiles p on p.id = n.user_id
        where n.kind like 'invoice.%' and p.role not in ('admin', 'office') and p.company_id <> $1`, [derby]);
    expect(leaks).toHaveLength(0);
    const lads = await system(db)<{ id: string }>(
      "select n.id from notifications n where n.kind like 'invoice.%' and n.user_id = any($1::uuid[])", [[ids.user("john"), ids.user("mark")]]);
    expect(lads).toHaveLength(0);
    const withAmount = await system(db)<{ id: string }>("select id from notifications where title like '%4250%' or body like '%4250%'");
    expect(withAmount).toHaveLength(0);
  });

  it("a boss can't send one for another company, or for a job their company was never given", async () => {
    await expect(asUser(db, "sarah").query(
      "insert into subcontractor_invoices (company_id, job_id, invoice_number, invoice_date, amount, file_name, file_size, storage_path) values ($1,$2,'X1','2026-11-20',10,'a.pdf',1,'companies/x/invoices/y.pdf')",
      [derby, ids.job("bm")])).rejects.toBeTruthy();
    await expect(uploadInvoice(boss("sarah", sos), input("riverside", "SOS-1"), { name: "a.pdf", bytes: pdf })).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, "john").query(
      "insert into subcontractor_invoices (company_id, job_id, invoice_number, invoice_date, amount, file_name, file_size, storage_path) values ($1,$2,'X2','2026-11-20',10,'a.pdf',1,'companies/x/invoices/z.pdf')",
      [derby, ids.job("bm")])).rejects.toBeTruthy();
  });

  it("only the office checks it; the boss is told; the invoice itself can't be altered", async () => {
    await asUser(db, "dave").query("update subcontractor_invoices set amount = 99999, status = 'checked' where id = $1", [invoiceId]).catch(() => {});
    let [row] = await system(db)<{ amount: string; status: string }>("select amount::text, status::text from subcontractor_invoices where id = $1", [invoiceId]);
    expect(row).toEqual({ amount: "4250.50", status: "submitted" });
    await asUser(db, "pete").query("update subcontractor_invoices set status = 'query', office_note = 'Daywork sheet 3 not signed', amount = 1 where id = $1", [invoiceId]);
    [row] = await system(db)<{ amount: string; status: string }>("select amount::text, status::text from subcontractor_invoices where id = $1", [invoiceId]);
    expect(row).toEqual({ amount: "4250.50", status: "query" });
    const told = await asUser(db, "dave").query<{ title: string }>("select title from notifications where kind = 'invoice.checked'");
    expect(told.map((t) => t.title)).toContain("Invoice DD-1001: MSW have a query");
  });
});
