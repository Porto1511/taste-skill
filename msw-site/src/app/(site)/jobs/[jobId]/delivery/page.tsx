import { redirect } from "next/navigation";

export default async function OldDeliveryRoute({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  redirect(`/deliveries/new?job=${encodeURIComponent(jobId)}`);
}
