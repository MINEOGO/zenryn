import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export function createSecureTempDir(baseDir?: string): string {
  const root = baseDir || os.tmpdir();
  const dirName = `zenryn-${crypto.randomBytes(12).toString("hex")}`;
  const fullPath = path.join(root, dirName);
  fs.mkdirSync(fullPath, { mode: 0o700, recursive: true });
  return fullPath;
}

export function cleanupTempDir(dirPath: string): void {
  if (!dirPath || !dirPath.includes("zenryn-")) {
    return;
  }
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {}
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
}
