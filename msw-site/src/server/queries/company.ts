import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";

export interface CardRow {
  id: string; user_id: string; card_type: string; card_number: string | null; expires_on: string | null;
  file_name: string; mime_type: string; created_at: string; uploaded_by_name: string | null;
}
export interface PersonRow {
  id: string; full_name: string; email: string; phone: string | null; job_title: string | null; role: string; active: boolean;
  cards: CardRow[]; job_ids: string[];
}
export interface CompanyJobRow { job_id: string; job_number: string; name: string; site_address: string; status: string; given_at: string }

const cardCols = "id, user_id, card_type, card_number, expires_on::text, file_name, mime_type, created_at, uploaded_by_name";

/** Cards for some people (RLS: themselves, their manager, the office). */
export async function listCards(viewer: Viewer, userIds: string[]): Promise<CardRow[]> {
  if (!userIds.length) return [];
  return withUser(viewer.id, async (tx) =>
    (await tx.query<CardRow>(`select ${cardCols} from operative_cards where user_id = any($1::uuid[]) order by card_type, created_at desc`, [userIds])).rows,
  );
}

/** Everything a manager needs on one screen: their jobs, their people, and each person's cards and jobs. */
export async function getCompanyOverview(viewer: Viewer) {
  return withUser(viewer.id, async (tx) => {
    const jobs = (await tx.query<CompanyJobRow>("select job_id, job_number, name, site_address, status::text, given_at from public.my_company_jobs()")).rows;
    const people = (await tx.query<Omit<PersonRow, "cards" | "job_ids">>(
      `select id, full_name, email, phone, job_title, role::text, active from profiles
        where company_id = $1 order by active desc, role = 'manager' desc, full_name`, [viewer.companyId],
    )).rows;
    const ids = people.map((p) => p.id);
    const cards = ids.length ? (await tx.query<CardRow>(`select ${cardCols} from operative_cards where user_id = any($1::uuid[]) order by card_type`, [ids])).rows : [];
    const ticks = ids.length ? (await tx.query<{ user_id: string; job_id: string }>(
      "select user_id, job_id from job_assignments where revoked_at is null and user_id = any($1::uuid[])", [ids],
    )).rows : [];
    return {
      jobs,
      people: people.map((p) => ({ ...p, cards: cards.filter((c) => c.user_id === p.id), job_ids: ticks.filter((t) => t.user_id === p.id).map((t) => t.job_id) })),
    };
  });
}

/** What the manager's company has done on one of its jobs: reports, daywork, variations and sign-offs. */
export async function getCompanyJobActivity(viewer: Viewer, jobId: string) {
  return withUser(viewer.id, async (tx) => {
    const reports = (await tx.query<{ id: string; kind: string; title: string; author_name: string; status: string | null; created_at: string }>(
      `select r.id, r.kind::text, r.title, r.author_name, r.status::text, r.created_at from reports r
        where r.job_id = $1 and r.author_company_id = $2 order by r.created_at desc limit 50`, [jobId, viewer.companyId],
    )).rows;
    const dayworks = (await tx.query<{ id: string; description: string; captured_by_name: string; signed_at: string }>(
      `select id, description, captured_by_name, signed_at from dayworks where job_id = $1 and captured_by_company_id = $2 order by signed_at desc limit 50`,
      [jobId, viewer.companyId],
    )).rows;
    const variations = (await tx.query<{ id: string; description: string; captured_by_name: string; signed_at: string }>(
      `select id, description, captured_by_name, signed_at from variations where job_id = $1 and captured_by_company_id = $2 order by signed_at desc limit 50`,
      [jobId, viewer.companyId],
    )).rows;
    const handovers = (await tx.query<{ id: string; title: string; captured_by_name: string; signed_at: string }>(
      `select h.id, h.title, h.captured_by_name, h.signed_at from handovers h
        join profiles p on p.id = h.captured_by
        where h.job_id = $1 and p.company_id = $2 order by h.signed_at desc limit 50`, [jobId, viewer.companyId],
    )).rows;
    return { reports, dayworks, variations, handovers };
  });
}
