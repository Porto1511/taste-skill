import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { SiteVisitList } from "@/components/site-visits/screens";

export const metadata: Metadata = { title: "Site visits" };

export default async function Page({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const viewer = await requireStaff();
  return <SiteVisitList viewer={viewer} base="/office/site-visits" deleted={Boolean((await searchParams).deleted)} />;
}
