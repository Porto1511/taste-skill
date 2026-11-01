import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/server/auth/viewer";

export default async function Home() {
  const viewer = await getViewer();
  redirect(viewer ? homePathFor(viewer) : "/login");
}
