import { redirect } from "next/navigation";

export default async function OldDeliveryViewRoute({ params }: { params: Promise<{ deliveryId: string }> }) {
  const { deliveryId } = await params;
  redirect(`/deliveries/${encodeURIComponent(deliveryId)}`);
}
