import path from "node:path";
import fs from "node:fs";

export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
