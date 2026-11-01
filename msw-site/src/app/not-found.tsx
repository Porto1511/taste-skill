import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center p-6 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-5 text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-muted">This page doesn&apos;t exist, or you don&apos;t have access to it. Job access is given individually by the MSW office.</p>
        <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-xl bg-ink px-5 font-semibold text-white">Go to my jobs</Link>
      </div>
    </main>
  );
}
