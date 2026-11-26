import type { Metadata } from "next";
import Link from "next/link";
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
        <p className="mt-4 text-[13px] text-muted">{viewer.isMswEmployee || viewer.isBoss ? "Your details and job access are managed by the MSW office." : "Your details and the jobs you can see are managed by your boss."}</p>
      </Card>
      {viewer.canSiteVisit && !viewer.isStaff && (
        <Link href="/site-visits" className="flex min-h-14 items-center justify-between rounded-[var(--radius-card)] bg-card px-4 font-semibold shadow-[var(--shadow-card)] ring-1 ring-line">
          <span>Site visits<span className="block text-[13px] font-normal text-muted">Record what&apos;s ready, blockers and photos</span></span>
          <span aria-hidden>→</span>
        </Link>
      )}
      {viewer.isBoss && (
        <Link href="/company" className="flex min-h-14 items-center justify-between rounded-[var(--radius-card)] bg-card px-4 font-semibold shadow-[var(--shadow-card)] ring-1 ring-line">
          <span>My company<span className="block text-[13px] font-normal text-muted">Your people, their cards and who sees each job</span></span>
          <span aria-hidden>→</span>
        </Link>
      )}
      {!viewer.isStaff && (
        <Link href="/account/cards" className="flex min-h-14 items-center justify-between rounded-[var(--radius-card)] bg-card px-4 font-semibold shadow-[var(--shadow-card)] ring-1 ring-line">
          <span>My cards<span className="block text-[13px] font-normal text-muted">CSCS and tickets — show, send or print</span></span>
          <span aria-hidden>→</span>
        </Link>
      )}
      <Link href="/certificates" className="flex min-h-14 items-center justify-between rounded-[var(--radius-card)] bg-card px-4 font-semibold shadow-[var(--shadow-card)] ring-1 ring-line">
        <span>Company certificates<span className="block text-[13px] font-normal text-muted">Print or send them to a client</span></span>
        <span aria-hidden>→</span>
      </Link>
      <section>
        <SectionTitle>Change password</SectionTitle>
        <Card className="p-4"><PasswordForm needsCurrent={config.mode === "demo"} /></Card>
      </section>
      {viewer.isStaff && (
        // Office staff using the site screens get back here; operatives never see this.
        <Link href="/office" className="flex h-14 items-center justify-center rounded-xl border border-line-strong bg-card text-[16px] font-semibold">Back to the office dashboard</Link>
      )}
      <form action={signOutAction}>
        <button type="submit" className="flex h-14 w-full items-center justify-center rounded-xl border border-danger/30 bg-card text-[16px] font-semibold text-danger">Sign out</button>
      </form>
    </div>
  );
}
