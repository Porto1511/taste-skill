"use client";

import { useState } from "react";
import { PaperPlaneTilt, DownloadSimple } from "@phosphor-icons/react";

/**
 * Send the signed PDF to the client from the phone (email, WhatsApp…) using
 * the phone's share sheet.  Automatic email from the server is a later setup.
 */
export function ShareCopy({ url, fileName, title, email, who = "client" }: { url: string; fileName: string; title: string; email?: string | null; who?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  async function share() {
    setState("busy");
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${title}${email ? ` — copy for ${email}` : ""}` });
      } else {
        // Desktop fallback: download, then open an email to the client.
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        if (email) window.location.href = `mailto:${email}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent("Please find your copy attached.")}`;
      }
      setState("idle");
    } catch (e) {
      setState((e as Error).name === "AbortError" ? "idle" : "error");
    }
  }
  return (
    <div className="grid gap-2">
      <button type="button" onClick={share} disabled={state === "busy"}
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-brand text-[16px] font-bold text-white disabled:opacity-60">
        <PaperPlaneTilt className="size-5" weight="fill" /> {state === "busy" ? "Preparing…" : `Send copy to ${who}`}
      </button>
      <a href={url} target="_blank" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-[15px] font-semibold">
        <DownloadSimple className="size-5" /> Open PDF
      </a>
      {state === "error" && <p className="text-[13px] text-danger">Couldn&apos;t share from this device. Use Open PDF and send it from there.</p>}
      {email && <p className="text-[12.5px] text-muted">Client email: {email}. Automatic emailing will be switched on once the MSW office email is set up.</p>}
    </div>
  );
}
