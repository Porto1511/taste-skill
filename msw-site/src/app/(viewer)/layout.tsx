import { requireViewer } from "@/server/auth/viewer";

export default async function ViewerLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return <div className="flex h-[100dvh] flex-col overflow-hidden bg-ink">{children}</div>;
}
