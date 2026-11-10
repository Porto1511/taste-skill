import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { config } from "@/server/config";
import { getViewer, homePathFor } from "@/server/auth/viewer";
import { demoEmail, demoUsers } from "@/server/seed/demo-data";
import { MswLogo } from "@/components/ui/logo";
import { Alert } from "@/components/ui/form";
import { LoginForm } from "./login-form";
import { ArrowRight, CaretDown, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { COMPANY } from "@/lib/company";
import { telHref } from "@/lib/format";
import { demoSignInAction } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const personas: { group: string; people: { key: string; hint: string }[] }[] = [
  { group: "MSW office", people: [
    { key: "claire", hint: "Admin · controls access" },
    { key: "sam", hint: "Office · documents & reports" },
    { key: "pete", hint: "QS · checks hours & deliveries against invoices" },
  ] },
  { group: "British Museum gangs", people: [
    { key: "john", hint: "Derby Decking · Levels 1–2" },
    { key: "liam", hint: "SOS · Levels 3–4" },
  ] },
  { group: "Check who can see what", people: [
    { key: "paul", hint: "Derby Decking · not on the British Museum job, so sees none of it" },
    { key: "dave", hint: "Derby Decking director · sees Derby Decking's own reports, only where the office allows" },
    { key: "gareth", hint: "MSW operative · every area, keeps a timesheet" },
  ] },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const viewer = await getViewer();
  if (viewer) redirect(homePathFor(viewer));
  const { next, error } = await searchParams;

  return (
    <main className="min-h-[100dvh] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Photo panel */}
      <section aria-hidden className="relative m-2 h-[30vh] min-h-52 overflow-hidden rounded-[1.75rem] bg-ink lg:m-3 lg:h-auto lg:rounded-[2rem]">
        <div className="absolute inset-0 bg-[url('/img/login-bg.webp')] bg-cover bg-[center_35%]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(8_9_12/0.35)_0%,transparent_30%,transparent_55%,rgb(8_9_12/0.7)_100%)]" />
        <div className="absolute left-4 top-4 lg:left-8 lg:top-8">
          <span className="block rounded-2xl bg-white/90 px-3 py-2 shadow-[0_8px_24px_-10px_rgb(0_0_0/0.5)] backdrop-blur-md"><MswLogo className="h-7 lg:h-8" /></span>
        </div>
        <p className="absolute bottom-4 left-5 text-[13px] font-medium text-white/90 lg:bottom-8 lg:left-8">{COMPANY.name} · Safety netting, decking &amp; shear studs</p>
      </section>

      {/* Sign-in */}
      <section className="flex flex-col px-5 pb-8 pt-6 sm:px-10 lg:px-16 lg:py-10">
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-[400px]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-muted">MSW Site</p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.025em]">Sign in</h1>
            <p className="mt-1.5 text-[15px] text-muted">For MSW staff and approved subcontractors.</p>
            <div className="mt-7 grid gap-4">
              {error && <Alert>{error}</Alert>}
              <LoginForm next={next} />
              <p className="text-[13px] leading-relaxed text-muted">
                Forgotten your password or need access? Call the office on{" "}
                <a href={telHref(COMPANY.phone)} className="whitespace-nowrap font-semibold text-ink underline underline-offset-2">{COMPANY.phone}</a>.
              </p>
            </div>

            {config.isDemo && (
              <details className="group mt-8 rounded-[1.25rem] bg-card ring-1 ring-line shadow-[var(--shadow-card)]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[14px] font-semibold text-ink">
                  <span className="flex items-center gap-2"><UsersThree className="size-5 text-muted" /> Try it as someone else</span>
                  <CaretDown className="size-4 text-muted transition-transform duration-300 group-open:rotate-180" weight="bold" />
                </summary>
                <div className="grid max-h-[45vh] gap-3 overflow-y-auto px-2 pb-3">
                  {personas.map((g) => (
                    <div key={g.group}>
                      <p className="mb-1 px-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-subtle">{g.group}</p>
                      <div className="grid gap-0.5">
                        {g.people.map((p) => {
                          const u = demoUsers.find((x) => x.key === p.key)!;
                          return (
                            <form key={p.key} action={demoSignInAction}>
                              <input type="hidden" name="email" value={demoEmail(u)} />
                              <button type="submit" className="group/p flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-paper active:scale-[0.99]">
                                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">{u.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[14px] font-semibold">{u.name}</span>
                                  <span className="block truncate text-[12px] text-muted">{p.hint}</span>
                                </span>
                                <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover/p:translate-x-0.5" weight="bold" />
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
        <footer className="mx-auto mt-10 w-full max-w-[400px] text-[12px] text-muted">© {COMPANY.name} · {COMPANY.address}</footer>
      </section>
    </main>
  );
}
