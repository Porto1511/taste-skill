import type { Metadata } from "next";
import { requireBoss } from "@/server/auth/viewer";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { AddOperativeForm } from "@/components/company/people-forms";

export const metadata: Metadata = { title: "Add a person" };

export default async function AddPersonPage() {
  const viewer = await requireBoss();
  return (
    <div>
      <PageHeader back={{ href: "/company", label: viewer.companyName }} title="Add a person"
        description="Give them a login. Then add their cards and tick the jobs they can see." />
      <Card className="p-5"><AddOperativeForm /></Card>
    </div>
  );
}
