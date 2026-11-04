import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { HandoverDetail } from "../queries/handovers";

const ink = rgb(0.09, 0.08, 0.06);
const muted = rgb(0.42, 0.4, 0.36);
const line = rgb(0.86, 0.84, 0.8);
const amber = rgb(1, 0.72, 0.11);
const green = rgb(0.08, 0.44, 0.23);

function wrap(text: string, font: PDFFont, size: number, max: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const w of para.split(/\s+/)) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > max && cur) { out.push(cur); cur = w; } else cur = next;
    }
    out.push(cur);
  }
  return out;
}

// Helvetica (WinAnsi) can't encode every character; replace the rest.
const clean = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E -ÿ–—•]/g, "?");

export async function buildHandoverCertificate(h: HandoverDetail, signature: Buffer, photos: Buffer[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Handover certificate — ${h.job_number} — ${h.title}`);
  pdf.setAuthor("MSW Site");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 48;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H;

  const header = () => {
    page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: ink });
    page.drawText("MSW", { x: M, y: H - 46, size: 22, font: bold, color: amber });
    page.drawText("HANDOVER CERTIFICATE", { x: M + 62, y: H - 36, size: 11, font: bold, color: rgb(1, 1, 1) });
    page.drawText(clean(`${h.job_number}  ·  ${h.job_name}`).slice(0, 80), { x: M + 62, y: H - 51, size: 8.5, font: regular, color: rgb(0.85, 0.85, 0.85) });
    y = H - 100;
  };
  const ensure = (n: number) => { if (y - n < 60) { page = pdf.addPage([W, H]); header(); } };
  const label = (t: string) => { ensure(30); page.drawText(t.toUpperCase(), { x: M, y, size: 7.5, font: bold, color: muted }); y -= 13; };
  const text = (t: string, size = 10, font = regular) => {
    for (const l of wrap(clean(t), font, size, W - 2 * M)) { ensure(size + 4); page.drawText(l, { x: M, y, size, font, color: ink }); y -= size + 4; }
    y -= 6;
  };
  const rule = () => { page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.6, color: line }); y -= 10; };

  header();
  page.drawText(clean(h.title).slice(0, 70), { x: M, y, size: 18, font: bold, color: ink }); y -= 22;
  text(`${h.area_name ?? "Whole job"}  ·  ${h.site_address}`, 10);
  rule();

  label("Main contractor"); text(h.main_contractor ?? h.signer_company);
  if (h.scope) { label("Scope of works handed over"); text(h.scope); }
  if (h.checklist.length) {
    label("Checklist");
    for (const c of h.checklist) {
      ensure(16);
      page.drawRectangle({ x: M, y: y - 2, width: 9, height: 9, borderColor: ink, borderWidth: 0.8, color: c.checked ? green : undefined });
      page.drawText(clean(`${c.checked ? "" : "(not confirmed) "}${c.label}`), { x: M + 16, y, size: 10, font: regular, color: c.checked ? ink : muted });
      y -= 15;
    }
    y -= 4;
  }
  if (h.drawing_refs.length) {
    label("Drawings current at handover");
    for (const d of h.drawing_refs) text(`${d.doc_number} rev ${d.revision} — ${d.title}`, 9.5);
  }
  rule();

  label("Declaration"); text(h.declaration, 10, bold);
  ensure(150);
  const sig = await pdf.embedPng(signature);
  const scale = Math.min(220 / sig.width, 80 / sig.height, 1);
  page.drawRectangle({ x: M, y: y - 92, width: 240, height: 96, borderColor: line, borderWidth: 0.8 });
  page.drawImage(sig, { x: M + 10, y: y - 86, width: sig.width * scale, height: sig.height * scale });
  const sx = M + 260;
  const signedAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(h.signed_at));
  [["Signed by", h.signer_name], ["Position", h.signer_position ?? "—"], ["Company", h.signer_company], ["Date & time", `${signedAt} (UK)`]]
    .forEach(([k, v], i) => {
      page.drawText(k.toUpperCase(), { x: sx, y: y - i * 24, size: 7, font: bold, color: muted });
      page.drawText(clean(v).slice(0, 48), { x: sx, y: y - i * 24 - 11, size: 10, font: regular, color: ink });
    });
  y -= 112;
  text(`Captured on site by ${h.captured_by_name} (${h.captured_by_company}) using MSW Site. Time recorded by the server.`, 8.5);

  for (const [i, bytes] of photos.slice(0, 6).entries()) {
    const img = await pdf.embedJpg(bytes);
    const w = (W - 2 * M - 12) / 2;
    const h2 = Math.min(w * (img.height / img.width), 200);
    if (i % 2 === 0) { ensure(h2 + 30); if (i === 0) label("Photos"); }
    const x = M + (i % 2) * (w + 12);
    page.drawImage(img, { x, y: y - h2, width: h2 * (img.width / img.height), height: h2 });
    if (i % 2 === 1 || i === photos.length - 1) y -= h2 + 14;
  }

  pdf.getPages().forEach((p, i, all) => {
    p.drawText(`MSW Site · Handover ${h.id.slice(0, 8)} · Page ${i + 1} of ${all.length}`, { x: M, y: 30, size: 7.5, font: regular, color: muted });
  });
  return Buffer.from(await pdf.save());
}
