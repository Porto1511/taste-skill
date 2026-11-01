import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { withUser } from "../db";
import { getSessionUserId } from "./session";

export type Role = "admin" | "office" | "operative" | "manager";

export interface Viewer {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  companyId: string;
  companyName: string;
  isMswEmployee: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  unreadNotifications: number;
}

/** The signed-in, active user for this request (memoised per request). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return withUser(userId, async (tx) => {
    const { rows } = await tx.query<{
      id: string; full_name: string; email: string; role: Role; job_title: string | null;
      company_id: string; company_name: string; is_msw: boolean; unread: number;
    }>(
      `select p.id, p.full_name, p.email, p.role, p.job_title, p.company_id, c.name as company_name, c.is_msw,
              (select count(*)::int from public.notifications n where n.user_id = p.id and n.read_at is null) as unread
       from public.profiles p
       join public.companies c on c.id = p.company_id
       where p.id = auth.uid() and p.active`,
    );
    const r = rows[0];
    if (!r) return null;
    await tx.query("select public.touch_last_seen()");
    return {
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      role: r.role,
      jobTitle: r.job_title,
      companyId: r.company_id,
      companyName: r.company_name,
      isMswEmployee: r.is_msw,
      isStaff: r.role === "admin" || r.role === "office",
      isAdmin: r.role === "admin",
      unreadNotifications: r.unread,
    };
  });
});

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

/** MSW office pages.  Non-staff get a 404 so the office area is not revealed. */
export async function requireStaff(): Promise<Viewer> {
  const v = await requireViewer();
  if (!v.isStaff) notFound();
  return v;
}

export async function requireAdmin(): Promise<Viewer> {
  const v = await requireStaff();
  if (!v.isAdmin) notFound();
  return v;
}

export function homePathFor(v: Pick<Viewer, "isStaff">) {
  return v.isStaff ? "/office" : "/jobs";
}
