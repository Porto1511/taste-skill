/**
 * Generates clearly-labelled SAMPLE site "photos" (illustrations) for the
 * demonstration environment.  They are not real photographs.
 */
import sharp from "sharp";

export type PhotoScene = "deck" | "edge" | "netting" | "materials" | "hoist" | "studs";

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export async function makeSamplePhoto(scene: PhotoScene, caption: string, variant = 0): Promise<Buffer> {
  const W = 1600;
  const H = 1200;
  const sky = ["#9fb7c9", "#b5c4cf", "#8ea9bf", "#c3cdd4"][variant % 4];
  const parts: string[] = [];

  // Sky and distant city
  parts.push(`<rect width="${W}" height="${H}" fill="${sky}"/>`);
  for (let i = 0; i < 14; i++) {
    const bw = 60 + ((i * 37 + variant * 11) % 90);
    const bh = 120 + ((i * 53 + variant * 17) % 220);
    parts.push(`<rect x="${i * 120 - 20}" y="${520 - bh}" width="${bw}" height="${bh}" fill="#7d8a94" opacity="0.55"/>`);
  }

  // Steel frame in perspective
  const steel = "#3b5168";
  for (let i = 0; i < 7; i++) {
    const x = 120 + i * 230;
    parts.push(`<rect x="${x}" y="300" width="26" height="560" fill="${steel}"/>`);
  }
  parts.push(`<rect x="80" y="300" width="1440" height="34" fill="${steel}"/>`);
  parts.push(`<rect x="80" y="560" width="1440" height="28" fill="${steel}"/>`);

  // Deck surface (trapezoidal profile) in the foreground
  const deckTop = scene === "netting" ? 820 : 760;
  parts.push(`<polygon points="0,${deckTop} ${W},${deckTop - 40} ${W},${H} 0,${H}" fill="#a7adb3"/>`);
  for (let i = -10; i < 40; i++) {
    const x = i * 60 + (variant % 3) * 10;
    parts.push(`<line x1="${x}" y1="${H}" x2="${x * 0.55 + 380}" y2="${deckTop - 20}" stroke="#8a9198" stroke-width="10"/>`);
  }

  if (scene === "edge") {
    // Missing edge protection: a gap in a barrier with hazard tape
    parts.push(`<rect x="0" y="${deckTop - 140}" width="620" height="16" fill="#e8b10f"/>`);
    parts.push(`<rect x="0" y="${deckTop - 80}" width="620" height="16" fill="#e8b10f"/>`);
    parts.push(`<rect x="980" y="${deckTop - 160}" width="620" height="16" fill="#e8b10f"/>`);
    parts.push(`<rect x="980" y="${deckTop - 100}" width="620" height="16" fill="#e8b10f"/>`);
    for (let i = 0; i < 12; i++) {
      parts.push(`<rect x="${640 + i * 28}" y="${deckTop - 110}" width="14" height="10" fill="${i % 2 ? "#111" : "#e8b10f"}"/>`);
    }
    parts.push(`<circle cx="800" cy="${deckTop - 220}" r="90" fill="none" stroke="#c81e1e" stroke-width="14"/>`);
  } else if (scene === "netting") {
    for (let i = 0; i < 30; i++) {
      parts.push(`<line x1="${i * 56}" y1="620" x2="${i * 56 + 60}" y2="${deckTop}" stroke="#1f6b4a" stroke-width="3"/>`);
      parts.push(`<line x1="${i * 56 + 60}" y1="620" x2="${i * 56}" y2="${deckTop}" stroke="#1f6b4a" stroke-width="3"/>`);
    }
  } else if (scene === "materials") {
    for (let k = 0; k < 6; k++) {
      parts.push(`<rect x="${420 + k * 6}" y="${deckTop + 40 - k * 22}" width="760" height="20" fill="${k % 2 ? "#c7ccd1" : "#b3b9bf"}" stroke="#7b838a"/>`);
    }
    parts.push(`<rect x="560" y="${deckTop - 120}" width="300" height="60" fill="#fff" stroke="#333"/>`);
    parts.push(`<text x="580" y="${deckTop - 80}" font-family="Helvetica, Arial" font-size="30" fill="#333">BUNDLE 14 / MD60</text>`);
  } else if (scene === "hoist") {
    parts.push(`<rect x="1180" y="180" width="200" height="700" fill="#d4d8dc" stroke="#555" stroke-width="6"/>`);
    parts.push(`<rect x="1210" y="420" width="140" height="200" fill="#f2c94c"/>`);
    parts.push(`<rect x="1150" y="660" width="260" height="70" fill="#c81e1e"/>`);
    parts.push(`<text x="1172" y="708" font-family="Helvetica, Arial" font-weight="bold" font-size="36" fill="#fff">OUT OF USE</text>`);
  } else if (scene === "studs") {
    for (let i = 0; i < 22; i++) {
      parts.push(`<rect x="${200 + i * 56}" y="${deckTop + 20 - i * 1.6}" width="14" height="44" rx="5" fill="#d9a441"/>`);
    }
  } else {
    parts.push(`<rect x="300" y="${deckTop - 20}" width="1000" height="14" fill="#5b6770"/>`);
  }

  // Caption band — clearly marks these as demonstration images
  parts.push(`<rect x="0" y="${H - 110}" width="${W}" height="110" fill="#111418" opacity="0.86"/>`);
  parts.push(`<text x="40" y="${H - 62}" font-family="Helvetica, Arial" font-weight="bold" font-size="38" fill="#ffbc1c">SAMPLE PHOTO · DEMONSTRATION DATA</text>`);
  parts.push(`<text x="40" y="${H - 22}" font-family="Helvetica, Arial" font-size="30" fill="#ffffff">${esc(caption)}</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
}
