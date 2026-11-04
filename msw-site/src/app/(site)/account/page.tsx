import type { Metadata } from "next";
import { requireViewer } from "@/server/auth/viewer";
import { config } from "@/server/config";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { PasswordForm } from "@/components/layout/password-form";
import { labels } from "@/lib/format";
import { signOutAction } from "@/app/login/actions";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await requireViewer();
  return (
    <div className="grid gap-6">
      <PageHeader title="Account" />
      <Card className="p-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-[12px] font-semibold text-muted">Name</dt><dd className="font-medium">{viewer.fullName}</dd></div>
          <div><dt className="text-[12px] font-semibold text-muted">Email</dt><dd className="font-medium">{viewer.email}</dd></div>
          <div><dt className="text-[12px] font-semibold text-muted">Company</dt><dd className="font-medium">{viewer.companyName}</dd></div>
          <div><dt className="text-[12px] font-semibold text-muted">Role</dt><dd className="font-medium">{labels.role[viewer.role]}</dd></div>
        </dl>
        <p className="mt-4 text-[13px] text-muted">Your details and job access are managed by the MSW office.</p>
      </Card>
      <section>
        <SectionTitle>Change password</SectionTitle>
        <Card className="p-4"><PasswordForm needsCurrent={config.mode === "demo"} /></Card>
      </section>
      <form action={signOutAction}>
        <button type="submit" className="flex h-14 w-full items-center justify-center rounded-xl border border-danger/30 bg-card text-[16px] font-semibold text-danger">Sign out</button>
      </form>
    </div>
  );
}
