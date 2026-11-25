import { getViewer } from "@/server/auth/viewer";
import { getSiteVisit } from "@/server/queries/site-visits";
import { buildSiteVisitReport } from "@/server/files/certificate";
import { notFound } from "@/server/files/serve";
import { getFileStore } from "@/server/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.canSiteVisit) return notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const v = await getSiteVisit(viewer, id);
  if (!v) return notFound();
  const store = getFileStore();
  const photos = (await Promise.all(v.photos.map((p) => store.get(p.storage_path)))).filter((b): b is Buffer => Boolean(b));
  const pdf = await buildSiteVisitReport(v, photos);
  const name = `MSW_site_visit_${v.job_number}_${v.visit_date}.pdf`.replace(/[^\w.-]+/g, "_");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${name}"`,
    },
  });
}
