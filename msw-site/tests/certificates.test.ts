/** Company certificate library: who can see and upload whose certs, and the files are protected the same way. */
import { beforeAll, describe, expect, it } from "vitest";
import type { Driver } from "@/server/db/types";
import { setDriverForTesting } from "@/server/db";
import { setFileStoreForTesting } from "@/server/storage";
import { deleteCertificate, uploadCertificate } from "@/server/files/certificates";
import { serveCertificate } from "@/server/files/serve";
import type { Viewer } from "@/server/auth/viewer";
import { asUser, createSeededDb, ids, system, type createMemoryStore } from "./support/db";

let db: Driver;
let store: ReturnType<typeof createMemoryStore>;
beforeAll(async () => { ({ driver: db, store } = await createSeededDb()); setDriverForTesting(db); setFileStoreForTesting(store); });

const v = (key: string, isStaff = false): Viewer => ({
  id: ids.user(key), fullName: key, email: "", role: isStaff ? "admin" : "operative", jobTitle: null, companyId: "", companyName: "",
  isMswEmployee: isStaff, isStaff, isAdmin: isStaff, keepsTimesheet: false, unreadNotifications: 0,
});
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
const company = async (name: string) => (await system(db)<{ id: string }>("select id from companies where name = $1", [name]))[0].id;

describe("company certificates", () => {
  it("the office files certs for any company; a subcontractor only for their own", async () => {
    const sos = await company("SOS");
    const msw = await company("MSW UK Ltd");
    const derby = await company("Derby Decking");
    const { id: mswCert } = await uploadCertificate(v("claire", true), msw, "MSW net certificates 2026", { name: "msw-nets.pdf", bytes: pdf });
    const { id: sosCert } = await uploadCertificate(v("liam"), sos, "SOS net certs", { name: "sos.pdf", bytes: pdf });
    await expect(uploadCertificate(v("liam"), derby, "Not mine", { name: "x.pdf", bytes: pdf })).rejects.toMatchObject({ code: "42501" });

    const titles = async (k: string) => (await asUser(db, k).query<{ title: string }>("select title from company_certificates order by title")).map((r) => r.title);
    expect(await titles("claire")).toEqual(["MSW net certificates 2026", "SOS net certs"]);
    expect(await titles("ryan")).toEqual(["SOS net certs"]); // same company as Liam
    expect(await titles("john")).toEqual([]); // Derby Decking sees neither
    expect(await titles("gareth")).toEqual(["MSW net certificates 2026"]); // MSW's own lads see MSW's

    expect((await serveCertificate(ids.user("ryan"), sosCert, false)).status).toBe(200);
    expect((await serveCertificate(ids.user("john"), sosCert, false)).status).toBe(404);
    expect((await serveCertificate(ids.user("john"), mswCert, false)).status).toBe(404);
  });

  it("only PDFs, and deleting removes the file", async () => {
    const sos = await company("SOS");
    await expect(uploadCertificate(v("liam"), sos, "Bad file", { name: "a.pdf", bytes: Buffer.from("MZ executable") })).rejects.toThrow(/not a PDF/);
    const before = store.files.size;
    const { id } = await uploadCertificate(v("liam"), sos, "Temp", { name: "t.pdf", bytes: pdf });
    expect(store.files.size).toBe(before + 1);
    await expect(deleteCertificate(v("john"), id)).rejects.toThrow(/not found/i);
    await deleteCertificate(v("liam"), id);
    expect(store.files.size).toBe(before);
  });
});
