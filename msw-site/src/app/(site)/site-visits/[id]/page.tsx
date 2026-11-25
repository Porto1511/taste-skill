import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { SiteVisitDetailView } from "@/components/site-visits/screens";

export const metadata: Metadata = { title: "Site visit" };
async function requireSiteVisits() {
  const viewer = await requireViewer();
  if (!viewer.canSiteVisit) notFound();
  return viewer;
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ photosFailed?: string }> }) {
  const viewer = await requireSiteVisits();
  return <SiteVisitDetailView viewer={viewer} base="/site-visits" id={(await params).id} photosFailed={Number((await searchParams).photosFailed) || 0} />;
}
