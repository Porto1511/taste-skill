import type { Metadata } from "next";
import { requireViewer } from "@/server/auth/viewer";
import { listNotifications } from "@/server/queries/site";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/layout/page-header";
import { requestNow } from "@/lib/now";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewer();
  const items = await listNotifications(viewer);
  return (
    <div>
      <PageHeader title="Notifications" back={{ href: "/jobs", label: "My jobs" }} />
      <NotificationList items={items} now={requestNow()} />
      <p className="mt-4 text-[13px] text-muted">Notifications appear in the app. Email and phone push alerts are not part of this release.</p>
    </div>
  );
}
