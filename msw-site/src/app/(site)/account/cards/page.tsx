import type { Metadata } from "next";
import { requireViewer } from "@/server/auth/viewer";
import { listCards } from "@/server/queries/company";
import { PageHeader } from "@/components/layout/page-header";
import { CardList } from "@/components/company/cards";
import { londonToday } from "@/lib/week";

export const metadata: Metadata = { title: "My cards" };

/** A lad's own cards and tickets, ready to show on site, send or print. */
export default async function MyCardsPage() {
  const viewer = await requireViewer();
  const cards = await listCards(viewer, [viewer.id]);
  return (
    <div>
      <PageHeader back={{ href: "/account", label: "Me" }} title="My cards"
        description={viewer.isBoss ? "Add your own cards from My company → your name." : "Show them on site, or send or print a copy. Your manager adds and updates them."} />
      <CardList cards={cards} today={londonToday()} canEdit={false} owner={viewer.fullName} />
    </div>
  );
}
