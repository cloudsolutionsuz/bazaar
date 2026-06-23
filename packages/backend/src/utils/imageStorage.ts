import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import { UPLOADS_DIR } from "../config/paths";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;

export async function saveCompressedImage(buffer: Buffer): Promise<string> {
  const filename = `${crypto.randomUUID()}.jpg`;
  const outputPath = path.join(UPLOADS_DIR, filename);

  await sharp(buffer)
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(outputPath);

  return `/uploads/${filename}`;
}

export async function deleteStoredImage(url: string): Promise<void> {
  const filename = path.basename(url);
  await fs.unlink(path.join(UPLOADS_DIR, filename)).catch(() => {});
}
