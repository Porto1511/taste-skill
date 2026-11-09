/**
 * Reads document number, revision and title from a drawing's file name so the
 * office doesn't have to type them, e.g.
 *   "MSW-2611-DK-105_C02_Level 5 Deck Layout.pdf" → MSW-2611-DK-105 / C02 / Level 5 Deck Layout
 *   "2611-SN-201 Rev P03 - Netting Layout L3.pdf" → 2611-SN-201 / P03 / Netting Layout L3
 * Anything it can't find is left blank for the user to fill in.
 */
export interface ParsedName { docNumber: string; revision: string; title: string; kind: "drawing" | "rams" }

const SEP = String.raw`[\s_\-\.\[\]\(\)]`;
const REV_WORD = new RegExp(String.raw`(?:^|${SEP})rev(?:ision)?${SEP}*([A-Z]?\d{1,3}[A-Z]?|[A-Z])(?=$|${SEP})`, "i");
const REV_CODE = new RegExp(String.raw`(?:^|${SEP})([PCTAS]\d{2})(?=$|${SEP})`, "i");
const NUMBER = /[A-Z0-9]+(?:-[A-Z0-9]+){2,}/i;

export function parseDrawingFileName(fileName: string): ParsedName {
  let stem = fileName.replace(/\.pdf$/i, "").trim();
  const kind = /\b(rams|method statement|risk assessment|ms[\s_-]?ra)\b/i.test(stem) ? "rams" : "drawing";

  let revision = "";
  const word = REV_WORD.exec(stem);
  if (word) { revision = word[1]; stem = stem.replace(word[0], " "); }

  let docNumber = "";
  const num = NUMBER.exec(stem);
  if (num) {
    docNumber = num[0];
    // "MSW-2611-DK-105-C02": a revision code stuck on the end of the number.
    const tail = /-([PCT]\d{2})$/i.exec(docNumber);
    if (tail && !revision && docNumber.split("-").length > 3) { revision = tail[1]; docNumber = docNumber.slice(0, -tail[0].length); }
    stem = stem.replace(num[0], " ");
  }
  if (!revision) {
    const code = REV_CODE.exec(stem);
    if (code) { revision = code[1]; stem = stem.replace(code[0], " "); }
  }

  const title = stem.replace(/[_]+/g, " ").replace(/\(\s*\)|\[\s*\]/g, " ").replace(/^[\s([]+|[\s)\]]+$/g, "").replace(/\s[-–]\s/g, " ").replace(/^[\s\-–.]+|[\s\-–.]+$/g, "").replace(/\s{2,}/g, " ").trim();
  return { docNumber: docNumber.toUpperCase(), revision: revision.toUpperCase(), title, kind };
}

/** C01 → C02, P09 → P10, B → C. Blank when it can't tell. */
export function nextRevision(rev?: string | null) {
  if (!rev) return "";
  const m = /^(.*?)(\d+)$/.exec(rev);
  if (m) return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0");
  if (/^[A-Y]$/i.test(rev)) return String.fromCharCode(rev.toUpperCase().charCodeAt(0) + 1);
  return "";
}

/** Picks the area named in the file name ("Level 3", "L3", "Roof"), if exactly one matches. */
export function guessArea(text: string, areas: { id: string; name: string }[]) {
  const norm = ` ${text.toLowerCase().replace(/[_\-.]+/g, " ")} `;
  const hits = areas.filter((a) => {
    const name = a.name.toLowerCase();
    if (norm.includes(` ${name} `)) return true;
    const lvl = /^level (\d+)$/.exec(name);
    return lvl ? new RegExp(String.raw`\s(l|lvl|level)\s?0?${lvl[1]}\s`).test(norm) : false;
  });
  return hits.length === 1 ? hits[0].id : "";
}
