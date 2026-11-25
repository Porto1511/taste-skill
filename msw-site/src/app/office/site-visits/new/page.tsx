import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { NewSiteVisit } from "@/components/site-visits/screens";

export const metadata: Metadata = { title: "New site visit" };

export default async function Page({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const viewer = await requireStaff();
  return <NewSiteVisit viewer={viewer} base="/office/site-visits" job={(await searchParams).job} />;
}
