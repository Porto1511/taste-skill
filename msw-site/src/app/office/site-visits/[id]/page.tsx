import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { SiteVisitDetailView } from "@/components/site-visits/screens";

export const metadata: Metadata = { title: "Site visit" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff();
  return <SiteVisitDetailView viewer={viewer} base="/office/site-visits" id={(await params).id} />;
}
