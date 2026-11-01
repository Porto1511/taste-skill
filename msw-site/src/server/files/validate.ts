import sharp from "sharp";
import { config } from "../config";
import { UserError } from "../errors";

export function assertPdf(bytes: Buffer, name: string) {
  if (bytes.length === 0) throw new UserError(`${name} is empty.`);
  if (bytes.length > config.maxPdfBytes) throw new UserError(`${name} is larger than ${config.maxPdfBytes / 1024 / 1024} MB.`);
  // The PDF header must appear within the first 1 KB.
  const head = bytes.subarray(0, 1024).toString("latin1");
  if (!head.includes("%PDF-")) throw new UserError(`${name} is not a PDF file.`);
}

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Validate and normalise an uploaded photo: decode it (rejecting anything
 * that is not a real image), apply EXIF orientation, cap the size and
 * re-encode as JPEG.  Re-encoding strips metadata such as GPS coordinates.
 */
export async function processPhoto(bytes: Buffer, label: string): Promise<ProcessedImage> {
  if (bytes.length === 0) throw new UserError(`${label} is empty.`);
  if (bytes.length > config.maxPhotoBytes) throw new UserError(`${label} is larger than ${config.maxPhotoBytes / 1024 / 1024} MB.`);
  try {
    const { data, info } = await sharp(bytes, { failOn: "error", limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new UserError(`${label} could not be read as an image. Use a JPEG, PNG or WebP photo.`);
  }
}

export async function makeThumbnail(bytes: Buffer, width = 480): Promise<Buffer> {
  return sharp(bytes).resize({ width, height: width, fit: "cover" }).jpeg({ quality: 72 }).toBuffer();
}

export function safeFileName(name: string, fallback: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").slice(0, 120);
  return cleaned || fallback;
}
