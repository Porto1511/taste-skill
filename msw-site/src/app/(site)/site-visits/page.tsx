import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { SiteVisitList } from "@/components/site-visits/screens";

export const metadata: Metadata = { title: "Site visits" };
async function requireSiteVisits() {
  const viewer = await requireViewer();
  if (!viewer.canSiteVisit) notFound();
  return viewer;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const viewer = await requireSiteVisits();
  return <SiteVisitList viewer={viewer} base="/site-visits" deleted={Boolean((await searchParams).deleted)} />;
}
