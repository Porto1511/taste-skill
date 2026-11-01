"use client";

import { useState } from "react";

export type UploadResult = { ok: true; body: Record<string, unknown> } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** XHR upload with progress (fetch cannot report upload progress). */
export function useUpload() {
  const [progress, setProgress] = useState<number | null>(null);
  const send = (url: string, data: FormData) =>
    new Promise<UploadResult>((resolve) => {
      setProgress(0);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
      xhr.onload = () => {
        setProgress(null);
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(xhr.responseText); } catch { /* empty */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true, body });
        else resolve({ ok: false, error: String(body.error ?? `Upload failed (${xhr.status})`), fieldErrors: body.fieldErrors as Record<string, string> | undefined });
      };
      xhr.onerror = () => { setProgress(null); resolve({ ok: false, error: "Connection lost during upload. Please try again." }); };
      xhr.send(data);
    });
  return { progress, send };
}
