import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { listNotifications } from "@/server/queries/site";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/layout/page-header";
import { requestNow } from "@/lib/now";

export const metadata: Metadata = { title: "Notifications" };

export default async function OfficeNotificationsPage() {
  const viewer = await requireStaff();
  const items = await listNotifications(viewer, 100);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" description="New site reports, replies and urgent issues for the jobs you manage." />
      <NotificationList items={items} now={requestNow()} />
    </div>
  );
}
