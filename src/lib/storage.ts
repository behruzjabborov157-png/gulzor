import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Local-disk image storage. Files are served by /media/[...path].
 * For serverless hosting (no persistent disk) replace these two functions with
 * an S3 / Supabase Storage implementation — the rest of the app only uses them.
 */

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp", "avif", "heif"]);

export function uploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || "./storage/uploads");
}

export class UploadError extends Error {}

/**
 * Validates the file by decoding it (not by trusting the extension or MIME type),
 * strips metadata (EXIF/GPS), resizes and re-encodes to WebP.
 * Returns the public URL.
 */
export async function saveImage(file: File, folder: "products" | "requests"): Promise<string> {
  if (!file || file.size === 0) throw new UploadError("Fayl tanlanmagan");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Fayl hajmi 6 MB dan oshmasligi kerak");
  const input = Buffer.from(await file.arrayBuffer());
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new UploadError("Fayl rasm emas yoki buzilgan");
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new UploadError("Faqat JPG, PNG, WEBP rasmlar qabul qilinadi");
  if ((meta.width ?? 0) * (meta.height ?? 0) > 50_000_000) throw new UploadError("Rasm o‘lchami juda katta");

  const out = await sharp(input).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.webp`;
  const dir = path.join(/*turbopackIgnore: true*/ uploadRoot(), folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), out);
  return `/media/${folder}/${name}`;
}

/** Resolves a /media path to a file on disk, refusing path traversal. */
export function resolveMediaPath(parts: string[]): string | null {
  if (parts.length !== 2 || !["products", "requests"].includes(parts[0])) return null;
  if (!/^[a-z0-9-]+\.webp$/.test(parts[1])) return null;
  return path.join(/*turbopackIgnore: true*/ uploadRoot(), parts[0], parts[1]);
}
