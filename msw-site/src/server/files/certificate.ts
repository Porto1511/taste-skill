import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { DayworkDetail, DeliveryDetail, HandoverDetail } from "../queries/handovers";
import { COMPANY, MSW_LOGO_PATHS, MSW_LOGO_VIEWBOX } from "@/lib/company";
import { DAYS, HANDOVER_TRADES, NOTES_FIELD, townFrom } from "@/lib/handover";

/*
  MSW completion certificates and daywork sheets, laid out like the paper
  forms (A4 landscape).  One electronic original serves as both the MSW
  (white) and client (yellow) copy.
*/

const W = 841.89, H = 595.28, M = 40;
const black = rgb(0, 0, 0);
const grey = rgb(0.4, 0.4, 0.4);
const red = rgb(0xd3 / 255, 0x11 / 255, 0x12 / 255);

const clean = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/×/g, "x")
    .replace(/[^\x20-\x7E -ÿ–—•]/g, "?");

function wrap(text: string, font: PDFFont, size: number, max: number) {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let cur = "";
    for (const w of para.split(/\s+/)) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > max && cur) { out.push(cur); cur = w; } else cur = next;
    }
    out.push(cur);
  }
  return out;
}

type Fonts = { reg: PDFFont; bold: PDFFont };

function box(p: PDFPage, x: number, y: number, w: number, h: number) {
  p.drawRectangle({ x, y, width: w, height: h, borderColor: black, borderWidth: 0.9 });
}
function txt(p: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = black) {
  p.drawText(clean(s), { x, y, size, font, color });
}
function centred(p: PDFPage, s: string, cx: number, y: number, size: number, font: PDFFont) {
  const t = clean(s);
  p.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y, size, font, color: black });
}
function para(p: PDFPage, s: string, x: number, y: number, w: number, size: number, font: PDFFont, centre = false, lineGap = 3) {
  let yy = y;
  for (const line of wrap(s, font, size, w)) {
    if (centre) centred(p, line, x + w / 2, yy, size, font); else txt(p, line, x, yy, size, font);
    yy -= size + lineGap;
  }
  return yy;
}
function tick(p: PDFPage, cx: number, cy: number) {
  p.drawLine({ start: { x: cx - 6, y: cy }, end: { x: cx - 1.5, y: cy - 5 }, thickness: 2, color: black });
  p.drawLine({ start: { x: cx - 1.5, y: cy - 5 }, end: { x: cx + 7, y: cy + 6 }, thickness: 2, color: black });
}

/** Logo + company details, top right (as on the paper forms). */
function letterhead(p: PDFPage, f: Fonts) {
  const v = MSW_LOGO_VIEWBOX;
  const logoW = 180;
  const scale = logoW / v.w;
  const cx = 640;
  const x = cx - logoW / 2 - v.x * scale;
  const y = H - 36 + v.y * scale;
  for (const d of MSW_LOGO_PATHS) p.drawSvgPath(d, { x, y, scale, color: red });
  let ly = H - 36 - v.h * scale - 18;
  for (const [line, size] of [[COMPANY.address, 9.5], [`Tel: ${COMPANY.phone}`, 9.5], [`Email: ${COMPANY.email}`, 8.5], [`Web: ${COMPANY.web}`, 8.5]] as const) {
    centred(p, line, cx, ly, size, f.reg);
    ly -= size + 7;
  }
}

/** Our Ref No / Customer / Contract Title / Contract Town table. */
function refTable(p: PDFPage, f: Fonts, title: string, rows: [string, string][]) {
  centred(p, title, M + 190, H - 52, 15, f.bold);
  const lw = 100, vw = 280, rh = 19;
  let y = H - 78;
  for (const [label, value] of rows) {
    box(p, M, y - rh, lw, rh);
    box(p, M + lw, y - rh, vw, rh);
    centred(p, label, M + lw / 2, y - 13.5, 9.5, f.reg);
    txt(p, value.slice(0, 60), M + lw + 6, y - 13.5, 9.5, f.bold);
    y -= rh;
  }
  return y;
}

function daysRow(p: PDFPage, f: Fonts, y: number, ticked: string[]) {
  const widths = [100, 104, 115, 106, 90, 104, 143];
  let x = M;
  DAYS.forEach((d, i) => {
    box(p, x, y - 18, widths[i], 18);
    box(p, x, y - 40, widths[i], 22);
    centred(p, d.label, x + widths[i] / 2, y - 13, 10, f.bold);
    if (ticked.includes(d.id)) tick(p, x + widths[i] / 2, y - 29);
    x += widths[i];
  });
  return y - 40;
}

async function signatureBlock(pdf: PDFDocument, p: PDFPage, f: Fonts, y: number, o: {
  dateLabel: string; date: string; msw: Buffer | null; mswName: string; client: Buffer; clientName: string; clientRole: string;
}) {
  const dots = (x: number, yy: number, w: number) => p.drawLine({ start: { x, y: yy }, end: { x: x + w, y: yy }, thickness: 0.6, color: grey, dashArray: [1, 2] });
  const place = async (bytes: Buffer, x: number, yy: number) => {
    const img: PDFImage = await pdf.embedPng(bytes);
    const s = Math.min(170 / img.width, 34 / img.height, 1);
    p.drawImage(img, { x, y: yy - 2, width: img.width * s, height: img.height * s });
  };
  txt(p, o.dateLabel, M, y, 10.5, f.reg);
  dots(M + 90, y - 2, 190);
  txt(p, o.date, M + 96, y + 1, 10.5, f.bold);
  txt(p, "Signed Client", 460, y, 10.5, f.reg);
  dots(560, y - 2, 200);
  await place(o.client, 566, y - 4);
  y -= 40;
  txt(p, "Signed MSW", M, y, 10.5, f.reg);
  dots(M + 90, y - 2, 190);
  if (o.msw) await place(o.msw, M + 96, y - 4);
  txt(p, "Print Name", 460, y, 10.5, f.reg);
  dots(560, y - 2, 200);
  txt(p, o.clientName.toUpperCase(), 566, y + 1, 10.5, f.bold);
  if (o.clientRole) txt(p, o.clientRole, 566, y - 12, 7.5, f.reg, grey);
  y -= 28;
  txt(p, "Print Name", M, y, 10.5, f.reg);
  dots(M + 90, y - 2, 190);
  txt(p, o.mswName.toUpperCase(), M + 96, y + 1, 10.5, f.bold);
  return y - 20;
}

function footer(p: PDFPage, f: Fonts, text: string) {
  txt(p, clean(text).slice(0, 190), M, 20, 7, f.reg, grey);
}

const ukDate = (iso: string) => {
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/London" }).format(d);
};
const ukDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(iso));

export async function buildHandoverCertificate(
  h: HandoverDetail, signatures: { client: Buffer; msw: Buffer | null }, photos: Buffer[],
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${h.job_number} completion certificate — ${h.title}`);
  pdf.setAuthor(COMPANY.name);
  const f: Fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const refs: [string, string][] = [
    ["Our Ref No:", h.job_number], ["Customer", h.main_contractor?.replace(/ \(fictional\)$/, "") ?? h.signer_company],
    ["Contract Title", h.job_name], ["Contract Town:", townFrom(h.site_address)],
  ];
  const trades = HANDOVER_TRADES.filter((t) => h.scopes.includes(t.id));
  const legacy = trades.length && !Object.keys(h.details ?? {}).length; // signed before certificates existed

  for (const t of trades) {
    const p = pdf.addPage([W, H]);
    letterhead(p, f);
    let y = refTable(p, f, t.title, refs) - 26;
    const d = (h.details?.[t.id] ?? {}) as Record<string, string>;
    const area = h.area_name ? `${h.area_name}` : "";

    if (t.id === "netting") {
      box(p, M, y - 20, W - 2 * M, 20);
      txt(p, t.statement, M + 4, y - 14, 10, f.reg);
      const top = y - 20, hgt = 150, half = (W - 2 * M) / 2;
      box(p, M, top - hgt, half, hgt);
      box(p, M + half, top - hgt, half, hgt);
      txt(p, "Gridlines / Level:-", M + 8, top - 14, 10, f.reg);
      txt(p, "Serial numbers of nets used:-", M + half + 8, top - 14, 10, f.reg);
      para(p, d.gridlines ?? (legacy ? area : ""), M + 8, top - 32, half - 16, 10.5, f.bold);
      para(p, d.serials ?? "", M + half + 8, top - 32, half - 16, 10.5, f.bold);
      y = top - hgt - 12;
    } else if (t.id === "studs") {
      const rows: [string, string][] = [["Floor Level:", d.floorLevel ?? area], ["Total Studs Welded:", d.totalStuds ?? ""], ["Stud Size:", d.studSize ?? ""]];
      let ry = y;
      for (const [label, value] of rows) {
        box(p, M + 0, ry - 30, 100, 30);
        box(p, M + 100, ry - 30, 280, 30);
        para(p, label, M + 4, ry - 13, 92, 10, f.reg, true, 1);
        txt(p, value.slice(0, 55), M + 106, ry - 19, 11, f.bold);
        ry -= 30;
      }
      para(p, t.statement, 470, y - 4, 330, 11, f.reg, true, 4);
      y = ry - 12;
    } else {
      txt(p, "Area Fixed (Deck & Edge Trim):", M, y - 6, 11, f.bold);
      para(p, d.area ?? (legacy ? `${area} ${h.title}` : ""), M, y - 24, 380, 10.5, f.reg);
      para(p, t.statement, 470, y - 20, 330, 11, f.reg, true, 4);
      y = y - 110;
    }

    // Notes / not finished
    const notes = d.notes?.trim();
    box(p, M, y - 44, W - 2 * M, 44);
    txt(p, `${NOTES_FIELD.label.replace(" / anything", " / items")}:`, M + 6, y - 13, 9.5, f.bold);
    para(p, notes || "None", M + 6, y - 27, W - 2 * M - 12, 9.5, f.reg, false, 2);
    y -= 56;

    y = daysRow(p, f, y, h.days_worked ?? []);
    y -= 30;
    await signatureBlock(pdf, p, f, y, {
      dateLabel: "W/C Date", date: h.week_commencing ? ukDate(h.week_commencing) : ukDate(h.signed_at),
      msw: signatures.msw, mswName: h.msw_signer_name ?? h.captured_by_name,
      client: signatures.client, clientName: h.signer_name, clientRole: [h.signer_position, h.signer_company].filter(Boolean).join(", "),
    });
    footer(p, f, `Signed electronically on site via MSW Site, ${ukDateTime(h.signed_at)} (UK). ${area ? `Area: ${area}. ` : ""}Ref ${h.id.slice(0, 8)}. MSW copy and client copy are identical.`);
  }

  if (photos.length) {
    const p = pdf.addPage([W, H]);
    txt(p, `Photos — ${h.job_number} ${h.title}`, M, H - 40, 13, f.bold);
    const cols = 3, gw = (W - 2 * M - 2 * 12) / cols, gh = 220;
    for (const [i, bytes] of photos.slice(0, 6).entries()) {
      const img = await pdf.embedJpg(bytes);
      const s = Math.min(gw / img.width, gh / img.height);
      const x = M + (i % cols) * (gw + 12);
      const y = H - 70 - Math.floor(i / cols) * (gh + 16) - img.height * s;
      p.drawImage(img, { x, y, width: img.width * s, height: img.height * s });
    }
    footer(p, f, `Ref ${h.id.slice(0, 8)}`);
  }
  return Buffer.from(await pdf.save());
}

export async function buildDayworkSheet(d: DayworkDetail, signatures: { client: Buffer; msw: Buffer }): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.job_number} daywork sheet — w/c ${d.week_commencing}`);
  pdf.setAuthor(COMPANY.name);
  const f: Fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const p = pdf.addPage([W, H]);
  letterhead(p, f);
  let y = refTable(p, f, "DAYWORK SHEET", [
    ["Our Ref No:", d.job_number], ["Customer", d.main_contractor?.replace(/ \(fictional\)$/, "") ?? d.client_company],
    ["Contract Title", d.job_name], ["Contract Town:", townFrom(d.site_address)],
  ]) - 22;

  // Name | Trade | Mon..Sun | Total Hours
  const cols = [150, 160, 50, 50, 50, 50, 50, 50, 50, 101];
  const heads = ["Name", "Trade", ...DAYS.map((x) => x.short), "Total Hours"];
  const fmt = (n: number) => (n ? (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "")) : "");
  const rows = Math.max(4, d.workers.length);
  let x = M;
  heads.forEach((hd, i) => { box(p, x, y - 18, cols[i], 18); centred(p, hd, x + cols[i] / 2, y - 13, 9.5, i < 2 ? f.bold : f.reg); x += cols[i]; });
  y -= 18;
  for (let r = 0; r < rows; r++) {
    const w = d.workers[r];
    x = M;
    const vals = w ? [w.name, w.trade, ...DAYS.map((day) => fmt(Number(w.hours[day.id] ?? 0))), fmt(DAYS.reduce((s, day) => s + Number(w.hours[day.id] ?? 0), 0))] : Array(10).fill("");
    vals.forEach((v, i) => {
      box(p, x, y - 18, cols[i], 18);
      if (i < 2) txt(p, String(v).slice(0, 28), x + 4, y - 13, 9, f.reg); else centred(p, String(v), x + cols[i] / 2, y - 13, 9.5, i === 9 ? f.bold : f.reg);
      x += cols[i];
    });
    y -= 18;
  }
  y -= 12;
  const fullW = W - 2 * M;
  box(p, M, y - 62, fullW, 62);
  txt(p, `Description of work:   ${d.kind === "standing" ? "STANDING TIME" : "EXTRA WORK"}`, M + 6, y - 13, 9.5, f.reg);
  para(p, d.description, M + 6, y - 28, fullW - 12, 9.5, f.bold, false, 2);
  y -= 74;
  box(p, M, y - 20, 120, 20); box(p, M + 120, y - 20, 140, 20);
  centred(p, "Week Commencing:", M + 60, y - 14, 10, f.reg);
  centred(p, ukDate(d.week_commencing), M + 190, y - 14, 10, f.bold);
  const cx = W - M - 380;
  box(p, cx, y - 20, 200, 20); box(p, cx + 200, y - 20, 90, 20); box(p, cx + 290, y - 20, 90, 20);
  centred(p, "Is work Complete:", cx + 100, y - 14, 10, f.reg);
  centred(p, "Yes", cx + 245, y - 14, 10, d.work_complete ? f.bold : f.reg);
  centred(p, "No", cx + 335, y - 14, 10, d.work_complete ? f.reg : f.bold);
  p.drawEllipse({ x: d.work_complete ? cx + 245 : cx + 335, y: y - 10, xScale: 22, yScale: 8, borderColor: black, borderWidth: 1.2 });
  y -= 32;
  box(p, M, y - 40, fullW, 40);
  txt(p, "Materials used:", M + 6, y - 13, 9.5, f.reg);
  para(p, d.materials ?? "None", M + 6, y - 27, fullW - 12, 9.5, f.bold, false, 2);
  y -= 64;
  await signatureBlock(pdf, p, f, y, {
    dateLabel: "Date", date: ukDate(d.signed_at), msw: signatures.msw, mswName: d.msw_signer_name ?? d.captured_by_name,
    client: signatures.client, clientName: d.client_name, clientRole: [d.client_position, d.client_company].filter(Boolean).join(", "),
  });
  footer(p, f, `Signed electronically on site via MSW Site, ${ukDateTime(d.signed_at)} (UK). Ref ${d.id.slice(0, 8)}. MSW copy and client copy are identical.`);
  return Buffer.from(await pdf.save());
}

export async function buildDeliveryNote(d: DeliveryDetail, signatures: { receiver: Buffer; driver: Buffer }): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.job_number} delivery note — ${ukDate(d.signed_at)}`);
  pdf.setAuthor(COMPANY.name);
  const f: Fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const p = pdf.addPage([W, H]);
  letterhead(p, f);
  let y = refTable(p, f, "DELIVERY NOTE", [
    ["Our Ref No:", d.job_number], ["Contract Title", d.job_name],
    ["Delivery Address", `${d.site_address}${d.postcode ? `, ${d.postcode}` : ""}`], ["Customer", d.main_contractor?.replace(/ \(fictional\)$/, "") ?? d.receiver_company],
  ]) - 22;
  const fullW = W - 2 * M;
  // Items
  const qtyW = 140;
  box(p, M, y - 18, fullW - qtyW, 18); box(p, M + fullW - qtyW, y - 18, qtyW, 18);
  txt(p, "Description of goods delivered", M + 6, y - 13, 10, f.bold);
  centred(p, "Quantity", M + fullW - qtyW / 2, y - 13, 10, f.bold);
  y -= 18;
  const rows = Math.max(5, Math.min(d.items.length, 12));
  for (let i = 0; i < rows; i++) {
    const it = d.items[i];
    box(p, M, y - 18, fullW - qtyW, 18); box(p, M + fullW - qtyW, y - 18, qtyW, 18);
    if (it) { txt(p, it.description.slice(0, 110), M + 6, y - 13, 9.5, f.reg); centred(p, it.quantity, M + fullW - qtyW / 2, y - 13, 9.5, f.reg); }
    y -= 18;
  }
  if (d.items.length > 12) { txt(p, `+ ${d.items.length - 12} more item(s) — see MSW Site record`, M, y - 12, 8.5, f.reg, grey); y -= 14; }
  y -= 10;
  const half = fullW / 2;
  box(p, M, y - 20, half, 20); box(p, M + half, y - 20, half, 20);
  txt(p, `Delivered by: ${d.delivered_by}`, M + 6, y - 14, 10, f.bold);
  txt(p, `Vehicle reg: ${d.vehicle_reg ?? "—"}`, M + half + 6, y - 14, 10, f.bold);
  y -= 30;
  box(p, M, y - 40, fullW, 40);
  txt(p, "Notes (shortages / damage):", M + 6, y - 13, 9.5, f.bold);
  para(p, d.notes || "None", M + 6, y - 27, fullW - 12, 9.5, f.reg, false, 2);
  y -= 64;
  // Signatures: driver (left), receiver (right)
  const dots = (x: number, yy: number, w: number) => p.drawLine({ start: { x, y: yy }, end: { x: x + w, y: yy }, thickness: 0.6, color: grey, dashArray: [1, 2] });
  const place = async (bytes: Buffer, x: number, yy: number) => {
    const img = await pdf.embedPng(bytes);
    const s = Math.min(170 / img.width, 34 / img.height, 1);
    p.drawImage(img, { x, y: yy - 2, width: img.width * s, height: img.height * s });
  };
  txt(p, "Date / time", M, y, 10.5, f.reg); dots(M + 90, y - 2, 190); txt(p, ukDateTime(d.signed_at), M + 96, y + 1, 10.5, f.bold);
  txt(p, "Received by", 460, y, 10.5, f.reg); dots(560, y - 2, 200); await place(signatures.receiver, 566, y - 4);
  y -= 40;
  txt(p, "Driver", M, y, 10.5, f.reg); dots(M + 90, y - 2, 190); await place(signatures.driver, M + 96, y - 4);
  txt(p, "Print Name", 460, y, 10.5, f.reg); dots(560, y - 2, 200); txt(p, d.receiver_name.toUpperCase(), 566, y + 1, 10.5, f.bold);
  txt(p, [d.receiver_position, d.receiver_company].filter(Boolean).join(", "), 566, y - 12, 7.5, f.reg, grey);
  y -= 28;
  txt(p, "Print Name", M, y, 10.5, f.reg); dots(M + 90, y - 2, 190); txt(p, d.delivered_by.toUpperCase(), M + 96, y + 1, 10.5, f.bold);
  footer(p, f, `Signed electronically on site via MSW Site, ${ukDateTime(d.signed_at)} (UK). Ref ${d.id.slice(0, 8)}. MSW copy and receiver copy are identical.`);
  return Buffer.from(await pdf.save());
}
