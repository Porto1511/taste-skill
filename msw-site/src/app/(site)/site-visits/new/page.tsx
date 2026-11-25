import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { NewSiteVisit } from "@/components/site-visits/screens";

export const metadata: Metadata = { title: "New site visit" };
async function requireSiteVisits() {
  const viewer = await requireViewer();
  if (!viewer.canSiteVisit) notFound();
  return viewer;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const viewer = await requireSiteVisits();
  return <NewSiteVisit viewer={viewer} base="/site-visits" job={(await searchParams).job} />;
}
