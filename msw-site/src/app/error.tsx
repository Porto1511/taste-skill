"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-[60dvh] place-items-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted">Please try again. If it keeps happening, contact the MSW office{error.digest ? ` and quote reference ${error.digest}` : ""}.</p>
        <button onClick={reset} className="mt-6 inline-flex h-12 items-center rounded-xl bg-signal px-5 font-semibold text-ink">Try again</button>
      </div>
    </main>
  );
}
