import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { config } from "@/server/config";
import { getViewer, homePathFor } from "@/server/auth/viewer";
import { demoEmail, demoUsers } from "@/server/seed/demo-data";
import { Logo } from "@/components/ui/logo";
import { Alert } from "@/components/ui/form";
import { LoginForm } from "./login-form";
import { demoSignInAction } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const personas: { group: string; people: { key: string; hint: string }[] }[] = [
  { group: "MSW office", people: [
    { key: "claire", hint: "Admin · controls access" },
    { key: "sam", hint: "Office · documents & reports" },
  ] },
  { group: "British Museum gangs", people: [
    { key: "john", hint: "ABC Decking · Levels 1–2" },
    { key: "liam", hint: "Northern Edge · Levels 3–4" },
  ] },
  { group: "Access boundaries", people: [
    { key: "paul", hint: "ABC Decking · NOT on British Museum" },
    { key: "dave", hint: "ABC director · reports by grant only" },
    { key: "gareth", hint: "MSW operative · all areas" },
  ] },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const viewer = await getViewer();
  if (viewer) redirect(homePathFor(viewer));
  const { next, error } = await searchParams;

  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <DeckPattern />
        <Logo sub="MSW UK Ltd" className="relative" />
        <div className="relative max-w-md">
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight">
            The right drawing.<br />
            <span className="text-signal">The right people.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/65">
            Approved drawings, RAMS and site information for every MSW job — with reporting straight back to the office.
          </p>
        </div>
        <p className="relative text-sm text-white/40">Safety netting · Metal decking · Shear studs · Edge trims · Concrete</p>
      </section>

      <section className="flex flex-col px-5 pb-10 pt-8 sm:px-10 lg:justify-center lg:px-16">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Logo tone="dark" sub="MSW UK Ltd" /></div>
          <h2 className="text-[28px] font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-muted">Use the email address MSW has registered for you.</p>
          <div className="mt-7 grid gap-4">
            {error && <Alert>{error}</Alert>}
            <LoginForm next={next} />
            <p className="text-sm text-muted">
              Forgotten your password or need access? Contact the MSW office — access to each job is set up individually.
            </p>
          </div>

          {config.isDemo && (
            <div className="mt-10 rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Demonstration accounts</p>
                <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-signal-ink">Demo mode</span>
              </div>
              <p className="mt-1 text-[13px] text-muted">Fictional data. Tap a person to sign in as them (password for all: <code className="font-mono text-ink">SiteDemo!2026</code>).</p>
              <div className="mt-3 grid gap-4">
                {personas.map((g) => (
                  <div key={g.group}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">{g.group}</p>
                    <div className="grid gap-1.5">
                      {g.people.map((p) => {
                        const u = demoUsers.find((x) => x.key === p.key)!;
                        return (
                          <form key={p.key} action={demoSignInAction}>
                            <input type="hidden" name="email" value={demoEmail(u)} />
                            <button type="submit" className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-ink/30 hover:bg-paper active:scale-[0.99]">
                              <span>
                                <span className="block text-[15px] font-semibold">{u.name}</span>
                                <span className="block text-[13px] text-muted">{p.hint}</span>
                              </span>
                              <span aria-hidden className="text-subtle">→</span>
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function DeckPattern() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
      <defs>
        <pattern id="deck" width="64" height="40" patternUnits="userSpaceOnUse">
          <path d="M0 30h10l6-18h16l6 18h10l6-18h10" fill="none" stroke="#fff" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#deck)" />
    </svg>
  );
}
