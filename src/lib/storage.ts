import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { getDb, schema } from "@/db";

/**
 * Uploaded-image storage, served by /media/[...path]. Two backends:
 * - disk (default): files under UPLOAD_DIR — for a VPS with a persistent disk;
 * - database (MEDIA_STORAGE=db): rows in media_files — for hosts whose disk is wiped on restart
 *   (Render's free tier). Images are re-encoded WebP of at most 1800 px, so they stay small.
 * The rest of the app only uses saveImage and readMedia.
 */

export const mediaInDb = () => process.env.MEDIA_STORAGE === "db";

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp", "avif", "heif"]);

export function uploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || "./storage/uploads");
}

/** code lets customer-facing forms translate the problem (t.errors.upload[code]); message is the Uzbek text. */
export class UploadError extends Error {
  constructor(
    public code: "none" | "tooBig" | "notImage" | "format" | "dimensions",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Validates the file by decoding it (not by trusting the extension or MIME type),
 * strips metadata (EXIF/GPS), resizes and re-encodes to WebP.
 * Returns the public URL.
 */
export async function saveImage(file: File, folder: "products" | "requests" | "orders"): Promise<string> {
  if (!file || file.size === 0) throw new UploadError("none", "Fayl tanlanmagan");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("tooBig", "Fayl hajmi 6 MB dan oshmasligi kerak");
  const input = Buffer.from(await file.arrayBuffer());
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new UploadError("notImage", "Fayl rasm emas yoki buzilgan");
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new UploadError("format", "Faqat JPG, PNG, WEBP rasmlar qabul qilinadi");
  if ((meta.width ?? 0) * (meta.height ?? 0) > 50_000_000) throw new UploadError("dimensions", "Rasm o‘lchami juda katta");

  const out = await sharp(input).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.webp`;
  if (mediaInDb()) {
    const db = await getDb();
    await db.insert(schema.mediaFiles).values({ path: `${folder}/${name}`, data: out });
  } else {
    const dir = path.join(/*turbopackIgnore: true*/ uploadRoot(), folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), out);
  }
  return `/media/${folder}/${name}`;
}

/** Validates a /media path (["products", "x.webp"]) and returns "products/x.webp", or null. Refuses path traversal. */
export function mediaKey(parts: string[]): string | null {
  if (parts.length !== 2 || !["products", "requests", "orders"].includes(parts[0])) return null;
  if (!/^[a-z0-9-]+\.webp$/.test(parts[1])) return null;
  return `${parts[0]}/${parts[1]}`;
}

/** Resolves a /media path to a file on disk (disk backend), or null for an invalid path. */
export function resolveMediaPath(parts: string[]): string | null {
  const key = mediaKey(parts);
  return key ? path.join(/*turbopackIgnore: true*/ uploadRoot(), key) : null;
}

/** The bytes of an uploaded image from whichever backend is configured, or null if it does not exist. */
export async function readMedia(parts: string[]): Promise<Buffer | null> {
  const key = mediaKey(parts);
  if (!key) return null;
  if (mediaInDb()) {
    const db = await getDb();
    const [row] = await db.select({ data: schema.mediaFiles.data }).from(schema.mediaFiles).where(eq(schema.mediaFiles.path, key));
    return row ? Buffer.from(row.data) : null;
  }
  try {
    return await fs.readFile(path.join(/*turbopackIgnore: true*/ uploadRoot(), key));
  } catch {
    return null;
  }
}
