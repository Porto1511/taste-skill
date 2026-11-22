import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";

export interface CertificateRow { id: string; company_id: string; title: string; file_name: string; file_size: number; uploaded_by_name: string | null; created_at: string }
export interface CertificateCompany { id: string; name: string; is_msw: boolean; certificates: CertificateRow[] }

/** Companies the viewer can file certificates for (office: all; others: their own), with their files. MSW first. */
export async function listCertificateLibrary(viewer: Viewer): Promise<CertificateCompany[]> {
  return withUser(viewer.id, async (tx) => {
    const companies = (await tx.query<{ id: string; name: string; is_msw: boolean }>(
      `select c.id, c.name, c.is_msw from companies c
        where c.active is not false and ($1::boolean or c.id = (select company_id from profiles where id = auth.uid()))
        order by c.is_msw desc, c.name`, [viewer.isStaff],
    )).rows;
    const certs = (await tx.query<CertificateRow>(
      "select id, company_id, title, file_name, file_size, uploaded_by_name, created_at from company_certificates order by created_at desc",
    )).rows;
    return companies.map((c) => ({ ...c, certificates: certs.filter((x) => x.company_id === c.id) }));
  });
}
