/**
 * Generates FICTIONAL demonstration drawings and RAMS as real PDF files.
 * Every sheet is watermarked as demonstration material.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, degrees } from "pdf-lib";

export type DrawingStyle = "deck" | "netting" | "studs" | "trims" | "ga";

export interface DrawingSpec {
  projectName: string;
  jobNumber: string;
  mainContractor: string;
  docNumber: string;
  title: string;
  revision: string;
  status: "approved" | "superseded" | "draft";
  date: string;
  areaLabel: string;
  style: DrawingStyle;
  history: { rev: string; date: string; note: string }[];
  variant: number;
}

const ink = rgb(0.09, 0.1, 0.12);
const grey = rgb(0.45, 0.47, 0.5);
const light = rgb(0.82, 0.83, 0.85);
const steel = rgb(0.16, 0.32, 0.55);
const amber = rgb(0.85, 0.55, 0.05);
const green = rgb(0.08, 0.5, 0.24);
const red = rgb(0.72, 0.1, 0.1);

function text(page: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = ink) {
  page.drawText(s, { x, y, size, font, color });
}

function box(page: PDFPage, x: number, y: number, w: number, h: number, width = 0.8, color = ink) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: width });
}

export async function makeDrawingPdf(spec: DrawingSpec): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${spec.docNumber} rev ${spec.revision} — ${spec.title}`);
  pdf.setAuthor("MSW UK Ltd (fictional demonstration data)");
  pdf.setSubject(spec.projectName);
  const page = pdf.addPage([1190.55, 841.89]); // A3 landscape
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const W = page.getWidth();
  const H = page.getHeight();

  // Sheet border
  box(page, 14, 14, W - 28, H - 28, 1.6);
  box(page, 20, 20, W - 40, H - 40, 0.5);

  // Drawing field
  const fx = 70;
  const fy = 70;
  const fw = W - 40 - 290 - fx;
  const fh = H - 40 - fy - 70;
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const rows = ["1", "2", "3", "4", "5", "6"];
  const dx = fw / (cols.length - 1);
  const dy = fh / (rows.length - 1);

  // Grid lines and bubbles
  cols.forEach((c, i) => {
    const x = fx + i * dx;
    page.drawLine({ start: { x, y: fy - 18 }, end: { x, y: fy + fh + 18 }, thickness: 0.35, color: grey, dashArray: [8, 3, 2, 3] });
    page.drawCircle({ x, y: fy + fh + 30, size: 9, borderColor: ink, borderWidth: 0.7 });
    text(page, c, x - 3.2, fy + fh + 26.5, 9, bold);
  });
  rows.forEach((r, j) => {
    const y = fy + j * dy;
    page.drawLine({ start: { x: fx - 18, y }, end: { x: fx + fw + 18, y }, thickness: 0.35, color: grey, dashArray: [8, 3, 2, 3] });
    page.drawCircle({ x: fx - 30, y, size: 9, borderColor: ink, borderWidth: 0.7 });
    text(page, r, fx - 32.5, y - 3.2, 9, bold);
  });

  // Primary steel on every grid line
  cols.forEach((_, i) => {
    const x = fx + i * dx;
    page.drawLine({ start: { x, y: fy }, end: { x, y: fy + fh }, thickness: 2.2, color: steel });
  });
  rows.forEach((_, j) => {
    const y = fy + j * dy;
    page.drawLine({ start: { x: fx, y }, end: { x: fx + fw, y }, thickness: 1.4, color: steel });
  });
  // Column markers
  cols.forEach((_, i) =>
    rows.forEach((__, j) => {
      page.drawRectangle({ x: fx + i * dx - 4, y: fy + j * dy - 4, width: 8, height: 8, color: ink });
    }),
  );

  const bay = (i: number, j: number) => ({ x: fx + i * dx, y: fy + j * dy, w: dx, h: dy });
  const omitted = new Set([`${(spec.variant + 2) % 7}-${(spec.variant + 1) % 5}`, `${(spec.variant + 4) % 7}-3`]);

  for (let i = 0; i < cols.length - 1; i++) {
    for (let j = 0; j < rows.length - 1; j++) {
      const b = bay(i, j);
      const key = `${i}-${j}`;
      if (omitted.has(key)) {
        // Openings / risers: cross-hatched, clearly marked
        page.drawLine({ start: { x: b.x + 6, y: b.y + 6 }, end: { x: b.x + b.w - 6, y: b.y + b.h - 6 }, thickness: 0.8, color: red });
        page.drawLine({ start: { x: b.x + 6, y: b.y + b.h - 6 }, end: { x: b.x + b.w - 6, y: b.y + 6 }, thickness: 0.8, color: red });
        text(page, "OPENING - NO DECK", b.x + b.w / 2 - 34, b.y + b.h / 2 + 4, 6, bold, red);
        text(page, "Edge protection by others", b.x + b.w / 2 - 36, b.y + b.h / 2 - 5, 4.5, regular, red);
        continue;
      }
      if (spec.style === "deck" || spec.style === "ga") {
        const pitch = 6;
        for (let x = b.x + 4; x < b.x + b.w - 3; x += pitch) {
          page.drawLine({ start: { x, y: b.y + 5 }, end: { x, y: b.y + b.h - 5 }, thickness: 0.25, color: light });
        }
        const sheetNo = `${cols[i]}${rows[j]}-${String(i * 5 + j + 1).padStart(2, "0")}`;
        text(page, sheetNo, b.x + 8, b.y + b.h - 14, 7, bold);
        text(page, spec.variant % 2 ? "MD60 1.0mm GALV" : "MD60 0.9mm GALV", b.x + 8, b.y + b.h - 22, 4.5, regular, grey);
        // Span arrow
        const ax = b.x + b.w / 2;
        page.drawLine({ start: { x: ax, y: b.y + 14 }, end: { x: ax, y: b.y + b.h - 30 }, thickness: 0.8, color: amber });
        page.drawLine({ start: { x: ax, y: b.y + b.h - 30 }, end: { x: ax - 4, y: b.y + b.h - 38 }, thickness: 0.8, color: amber });
        page.drawLine({ start: { x: ax, y: b.y + b.h - 30 }, end: { x: ax + 4, y: b.y + b.h - 38 }, thickness: 0.8, color: amber });
        page.drawLine({ start: { x: ax, y: b.y + 14 }, end: { x: ax - 4, y: b.y + 22 }, thickness: 0.8, color: amber });
        page.drawLine({ start: { x: ax, y: b.y + 14 }, end: { x: ax + 4, y: b.y + 22 }, thickness: 0.8, color: amber });
        text(page, "SPAN", ax + 4, b.y + b.h / 2, 4, regular, amber);
        text(page, `Fix @ 300 c/c, side laps @ 450 c/c - see note ${1 + ((i + j) % 4)}`, b.x + 6, b.y + 7, 3.4, regular, grey);
      } else if (spec.style === "netting") {
        for (let k = 0; k <= 6; k++) {
          const x = b.x + (k * b.w) / 6;
          page.drawLine({ start: { x, y: b.y + 3 }, end: { x, y: b.y + b.h - 3 }, thickness: 0.3, color: rgb(0.1, 0.45, 0.3) });
        }
        for (let k = 0; k <= 5; k++) {
          const y = b.y + (k * b.h) / 5;
          page.drawLine({ start: { x: b.x + 3, y }, end: { x: b.x + b.w - 3, y }, thickness: 0.3, color: rgb(0.1, 0.45, 0.3) });
        }
        text(page, `NET ${cols[i]}${rows[j]}`, b.x + 8, b.y + b.h - 14, 7, bold, rgb(0.1, 0.45, 0.3));
        text(page, "Type A net, 100mm mesh, tie-offs @ 750 max", b.x + 8, b.y + 8, 3.6, regular, grey);
      } else if (spec.style === "studs") {
        const n = 9;
        for (let k = 1; k < n; k++) {
          page.drawCircle({ x: b.x + (k * b.w) / n, y: b.y + 3, size: 1.6, color: amber });
          page.drawCircle({ x: b.x + (k * b.w) / n, y: b.y + b.h - 3, size: 1.6, color: amber });
        }
        text(page, `${2 + ((i + j) % 2)} No. 19x100 TRS studs per trough`, b.x + 8, b.y + b.h / 2, 4.2, regular, grey);
      } else if (spec.style === "trims") {
        if (i === 0 || j === 0 || i === cols.length - 2 || j === rows.length - 2) {
          page.drawRectangle({ x: b.x + 2, y: b.y + 2, width: b.w - 4, height: b.h - 4, borderColor: amber, borderWidth: 1.6 });
          text(page, `ET${1 + ((i + j) % 3)} 150mm edge trim`, b.x + 8, b.y + b.h / 2, 5, bold, amber);
          text(page, "Restraint straps @ 600 c/c", b.x + 8, b.y + b.h / 2 - 8, 3.6, regular, grey);
        }
      }
    }
  }

  // Dimension string along the top
  for (let i = 0; i < cols.length - 1; i++) {
    const x1 = fx + i * dx;
    const x2 = x1 + dx;
    page.drawLine({ start: { x: x1, y: fy + fh + 50 }, end: { x: x2, y: fy + fh + 50 }, thickness: 0.4, color: ink });
    text(page, String(7500 + ((i + spec.variant) % 3) * 750), (x1 + x2) / 2 - 10, fy + fh + 53, 5.5, regular);
  }

  // Area label
  text(page, spec.areaLabel.toUpperCase(), fx, fy - 46, 16, bold);
  text(page, spec.title, fx, fy - 60, 8, regular, grey);

  // Notes panel
  const nx = W - 40 - 280 + 10;
  let ny = H - 50;
  text(page, "NOTES", nx, ny, 9, bold);
  const notes = [
    "1. All dimensions in mm. Do not scale.",
    "2. Read with structural engineer's drawings.",
    "3. Deck to be fixed to steel with 4.5mm",
    "   shot-fired pins or self-drilling screws.",
    "4. Side laps stitched @ 450mm c/c max.",
    "5. Edge protection / netting to be in place",
    "   before deck is laid at leading edges.",
    "6. Report any discrepancy to MSW office",
    "   via MSW Site before proceeding.",
  ];
  ny -= 14;
  for (const n of notes) {
    text(page, n, nx, ny, 6.5, regular);
    ny -= 10;
  }

  // Revision table
  const tbx = nx - 10;
  const tbw = 280;
  let ty = 300;
  box(page, tbx, ty, tbw, 18 + 12 * Math.max(spec.history.length, 1), 0.6);
  text(page, "REV", tbx + 6, ty + 6 + 12 * Math.max(spec.history.length, 1), 6.5, bold);
  text(page, "DATE", tbx + 40, ty + 6 + 12 * Math.max(spec.history.length, 1), 6.5, bold);
  text(page, "DESCRIPTION", tbx + 100, ty + 6 + 12 * Math.max(spec.history.length, 1), 6.5, bold);
  spec.history.forEach((h, idx) => {
    const y = ty + 6 + 12 * (spec.history.length - 1 - idx);
    text(page, h.rev, tbx + 6, y, 6.5, mono);
    text(page, h.date, tbx + 40, y, 6.5, mono);
    text(page, h.note.slice(0, 44), tbx + 100, y, 6.5, regular);
  });

  // Title block
  ty = 26;
  const tbh = 262;
  box(page, tbx, ty, tbw, tbh, 1.2);
  page.drawRectangle({ x: tbx, y: ty + tbh - 46, width: tbw, height: 46, color: ink });
  text(page, "MSW", tbx + 12, ty + tbh - 32, 22, bold, rgb(1, 0.74, 0.11));
  text(page, "UK LTD", tbx + 72, ty + tbh - 22, 8, bold, rgb(1, 1, 1));
  text(page, "Safety netting  |  Metal decking  |  Shear studs  |  Edge trims", tbx + 72, ty + tbh - 33, 5.5, regular, rgb(0.85, 0.85, 0.85));

  const rowsTB: [string, string][] = [
    ["PROJECT", spec.projectName],
    ["MSW JOB No.", spec.jobNumber],
    ["CLIENT / MAIN CONTRACTOR", spec.mainContractor],
    ["DRAWING TITLE", spec.title],
  ];
  let ry = ty + tbh - 62;
  for (const [label, value] of rowsTB) {
    text(page, label, tbx + 8, ry, 5.5, regular, grey);
    text(page, value.slice(0, 52), tbx + 8, ry - 10, 8.5, bold);
    page.drawLine({ start: { x: tbx, y: ry - 16 }, end: { x: tbx + tbw, y: ry - 16 }, thickness: 0.4, color: light });
    ry -= 30;
  }
  text(page, "DRAWING No.", tbx + 8, ry, 5.5, regular, grey);
  text(page, spec.docNumber, tbx + 8, ry - 14, 13, bold);
  text(page, "REV", tbx + 200, ry, 5.5, regular, grey);
  text(page, spec.revision, tbx + 200, ry - 14, 13, bold);
  text(page, "DATE", tbx + 8, ry - 30, 5.5, regular, grey);
  text(page, spec.date, tbx + 8, ry - 40, 8, regular);
  text(page, "SCALE", tbx + 100, ry - 30, 5.5, regular, grey);
  text(page, "1:100 @ A3", tbx + 100, ry - 40, 8, regular);

  // Status stamp
  const stampY = ty + 8;
  if (spec.status === "approved") {
    page.drawRectangle({ x: tbx + 8, y: stampY, width: tbw - 16, height: 22, borderColor: green, borderWidth: 1.6 });
    text(page, "APPROVED FOR CONSTRUCTION", tbx + 52, stampY + 7, 10, bold, green);
  } else if (spec.status === "draft") {
    page.drawRectangle({ x: tbx + 8, y: stampY, width: tbw - 16, height: 22, borderColor: amber, borderWidth: 1.6 });
    text(page, "PRELIMINARY - NOT FOR CONSTRUCTION", tbx + 30, stampY + 7, 10, bold, amber);
  } else {
    page.drawRectangle({ x: tbx + 8, y: stampY, width: tbw - 16, height: 22, borderColor: red, borderWidth: 1.6 });
    text(page, "SUPERSEDED - DO NOT USE", tbx + 62, stampY + 7, 10, bold, red);
    page.drawText("SUPERSEDED", { x: 260, y: 230, size: 120, font: bold, color: red, opacity: 0.12, rotate: degrees(24) });
  }

  // Demo watermark
  page.drawText("FICTIONAL DEMONSTRATION DRAWING", {
    x: 170, y: 120, size: 44, font: bold, color: grey, opacity: 0.08, rotate: degrees(24),
  });

  return Buffer.from(await pdf.save());
}

// ---------------------------------------------------------------------------
// RAMS
// ---------------------------------------------------------------------------
export interface RamsSpec {
  projectName: string;
  jobNumber: string;
  mainContractor: string;
  reference: string;
  title: string;
  revision: string;
  date: string;
  activity: string;
  hazards: { hazard: string; risk: string; controls: string }[];
  sequence: string[];
  ppe: string[];
}

function wrap(s: string, font: PDFFont, size: number, max: number): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function makeRamsPdf(spec: RamsSpec): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${spec.reference} rev ${spec.revision} — ${spec.title}`);
  pdf.setAuthor("MSW UK Ltd (fictional demonstration data)");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const M = 48;
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: ink });
    text(page, "MSW", M, H - 42, 20, bold, rgb(1, 0.74, 0.11));
    text(page, "RISK ASSESSMENT & METHOD STATEMENT", M + 58, H - 30, 9, bold, rgb(1, 1, 1));
    text(page, `${spec.reference}  |  Rev ${spec.revision}  |  ${spec.date}`, M + 58, H - 43, 8, regular, rgb(0.85, 0.85, 0.85));
    page.drawText("FICTIONAL DEMONSTRATION DOCUMENT", {
      x: 90, y: 260, size: 30, font: bold, color: grey, opacity: 0.07, rotate: degrees(40),
    });
    y = H - 96;
  };
  const ensure = (needed: number) => {
    if (y - needed < 70) newPage();
  };
  const heading = (s: string) => {
    ensure(40);
    y -= 8;
    text(page, s.toUpperCase(), M, y, 10, bold);
    page.drawLine({ start: { x: M, y: y - 5 }, end: { x: W - M, y: y - 5 }, thickness: 0.8, color: amber });
    y -= 20;
  };
  const para = (s: string, size = 9.5) => {
    for (const line of wrap(s, regular, size, W - 2 * M)) {
      ensure(14);
      text(page, line, M, y, size, regular);
      y -= size + 4;
    }
    y -= 4;
  };

  newPage();
  text(page, spec.title, M, y, 18, bold);
  y -= 22;
  text(page, spec.projectName, M, y, 10.5, regular, grey);
  y -= 26;

  const meta: [string, string][] = [
    ["MSW job number", spec.jobNumber],
    ["Main contractor", spec.mainContractor],
    ["Activity", spec.activity],
    ["Document reference", `${spec.reference} rev ${spec.revision}`],
  ];
  for (const [k, v] of meta) {
    text(page, k, M, y, 8, regular, grey);
    text(page, v, M + 130, y, 9.5, bold);
    y -= 16;
  }
  y -= 6;

  page.drawRectangle({ x: M, y: y - 46, width: W - 2 * M, height: 50, color: rgb(1, 0.96, 0.85), borderColor: amber, borderWidth: 0.8 });
  const notice = wrap(
    "This digital copy is provided for reference. It does NOT replace the site-specific briefing, the signed hard-copy RAMS or any acknowledgement required by the main contractor. Stop and ask if anything on site differs from this document.",
    regular, 8.5, W - 2 * M - 16,
  );
  notice.forEach((l, i) => text(page, l, M + 8, y - 12 - i * 11, 8.5, regular));
  y -= 66;

  heading("1. Scope of works");
  para(`This RAMS covers ${spec.activity.toLowerCase()} carried out by MSW UK Ltd and its approved subcontractors at ${spec.projectName}. Works are to be carried out only in the areas allocated by the MSW office and only to current approved-for-construction drawings available in MSW Site.`);

  heading("2. Sequence of works");
  spec.sequence.forEach((s, i) => para(`${i + 1}. ${s}`));

  heading("3. Hazards and controls");
  for (const h of spec.hazards) {
    ensure(50);
    text(page, h.hazard, M, y, 9.5, bold);
    text(page, `Risk: ${h.risk}`, W - M - 90, y, 8.5, bold, h.risk === "High" ? red : amber);
    y -= 14;
    para(h.controls, 9);
  }

  heading("4. Personal protective equipment");
  para(spec.ppe.join(", ") + ".");

  heading("5. Emergency arrangements");
  para("In an emergency follow the main contractor's site emergency procedure. Raise the alarm, make the area safe if it is safe to do so, and inform the site manager immediately by phone. Urgent safety issues must be communicated in person or by telephone - reporting in MSW Site is in addition to, not instead of, immediate communication.");
  para("Rescue from height: a site-specific rescue plan must be briefed before work at height starts. Rescue equipment must be on the working level at all times.");

  heading("6. Briefing record");
  para("Operatives must be briefed on this RAMS and sign the hard-copy briefing register held on site before starting work. The briefing register is retained by the MSW supervisor.");

  pages.forEach((p, i) => {
    text(p, `Page ${i + 1} of ${pages.length}`, W - M - 50, 30, 7.5, regular, grey);
    text(p, "Uncontrolled when printed - always check MSW Site for the current revision.", M, 30, 7.5, regular, grey);
  });

  return Buffer.from(await pdf.save());
}
