import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { config } from "@/server/config";
import { getViewer, homePathFor } from "@/server/auth/viewer";
import { demoEmail, demoUsers } from "@/server/seed/demo-data";
import { Logo } from "@/components/ui/logo";
import { Alert } from "@/components/ui/form";
import { LoginForm } from "./login-form";
import { ArrowRight, CaretDown, ClockClockwise, Phone, ShieldCheck, Signature, UsersThree } from "@phosphor-icons/react/dist/ssr";
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
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-ink text-white">
      {/* Backdrop: the photo, softened, under a dark tint so text and form stay crisp. */}
      <div aria-hidden className="absolute inset-0 -z-10 scale-105 bg-[url('/img/login-bg.webp')] bg-cover bg-[center_40%]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(8_9_12/0.92)_0%,rgb(8_9_12/0.72)_45%,rgb(8_9_12/0.45)_100%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgb(8_9_12/0.85)_0%,transparent_45%)]" />
      <span aria-hidden className="orb -bottom-40 -left-32 -z-10 size-[34rem] bg-brand/30" />

      <div className="mx-auto flex min-h-[100dvh] max-w-[1280px] flex-col px-5 py-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Logo sub="MSW UK Ltd" />
          <a href={telHref(COMPANY.phone)} className="hidden min-h-11 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[14px] font-medium text-white/85 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/[0.14] sm:flex">
            <Phone className="size-4" weight="fill" /> Need access? {COMPANY.phone}
          </a>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_440px] lg:gap-16 lg:py-12">
          <section className="max-w-xl">
            <p className="w-fit rounded-full bg-white/[0.08] px-3 py-1 text-[12px] font-medium uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/15 backdrop-blur-md">MSW Site</p>
            <h2 className="mt-5 text-[40px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[56px] lg:text-[64px]">
              The right drawing.<br />
              <span className="bg-[linear-gradient(90deg,#ff4b4c,#d31112)] bg-clip-text text-transparent">The right people.</span>
            </h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/75">
              Approved drawings, RAMS, sign-offs and timesheets for every MSW job — on site and in the office.
            </p>
            <ul className="mt-8 hidden flex-wrap gap-2 sm:flex">
              {[
                [<ShieldCheck key="a" weight="fill" />, "Only approved drawings on site"],
                [<Signature key="b" weight="fill" />, "Handovers signed on the phone"],
                [<ClockClockwise key="c" weight="fill" />, "Timesheets & daywork in one place"],
              ].map(([icon, text]) => (
                <li key={text as string} className="flex items-center gap-2 rounded-full bg-white/[0.07] py-1.5 pl-1.5 pr-3.5 text-[13px] text-white/85 ring-1 ring-white/10 backdrop-blur-md">
                  <span className="grid size-6 place-items-center rounded-full bg-brand text-white [&_svg]:size-3.5">{icon}</span>{text}
                </li>
              ))}
            </ul>
          </section>

          <section className="w-full">
            <div className="rounded-[2rem] bg-white/[0.06] p-1.5 ring-1 ring-white/15 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] backdrop-blur-xl">
              <div className="rounded-[calc(2rem-0.375rem)] bg-white/95 px-6 pb-6 pt-7 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.9)] sm:px-8 sm:pt-8">
                <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Sign in</h1>
                <p className="mt-1 text-[15px] text-muted">Use the email address MSW has registered for you.</p>
                <div className="mt-6 grid gap-4">
                  {error && <Alert>{error}</Alert>}
                  <LoginForm next={next} />
                  <p className="text-[13px] leading-relaxed text-muted">
                    Forgotten your password or need access? Call the MSW office on <a href={telHref(COMPANY.phone)} className="font-semibold text-ink underline underline-offset-2">{COMPANY.phone}</a>.
                  </p>
                </div>

                {config.isDemo && (
                  <details className="group mt-6 border-t border-line pt-4">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[14px] font-semibold text-ink">
                      <span className="flex items-center gap-2"><UsersThree className="size-5 text-brand" weight="fill" /> Try it as someone else</span>
                      <CaretDown className="size-4 text-muted transition-transform duration-300 group-open:rotate-180" weight="bold" />
                    </summary>
                    <p className="mb-3 text-[13px] text-muted">Tap a person to go straight in as them.</p>
                    <div className="grid max-h-[40vh] gap-3 overflow-y-auto pr-1">
                      {personas.map((g) => (
                        <div key={g.group}>
                          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-subtle">{g.group}</p>
                          <div className="grid gap-1.5">
                            {g.people.map((p) => {
                              const u = demoUsers.find((x) => x.key === p.key)!;
                              return (
                                <form key={p.key} action={demoSignInAction}>
                                  <input type="hidden" name="email" value={demoEmail(u)} />
                                  <button type="submit" className="group/p flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-paper active:scale-[0.99]">
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
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/70">
          <span>© {COMPANY.name} · {COMPANY.address}</span>
          <span>Safety netting · Metal decking · Shear studs · Edge trims · Concrete</span>
        </footer>
      </div>
    </main>
  );
}
