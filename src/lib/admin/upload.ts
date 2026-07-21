import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 20 * 1024 * 1024; // matches legacy MAX_IMAGE_SIZE
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Store an uploaded image under `public/uploads/<dir>/` and return the
 * upload-relative path (e.g. `products/ab12….jpg`) that `imageUrl()` resolves.
 *
 * Local-disk storage matches the legacy app's behaviour. On a multi-instance
 * or read-only deployment this should be swapped for object storage — the
 * return contract stays the same.
 */
export async function saveUpload(file: File, dir = "products"): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: false, error: "No file provided" };
  if (file.size > MAX_BYTES) return { ok: false, error: "Image must be 20MB or smaller" };
  if (!ALLOWED.has(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image" };
  }

  // Derive the extension from the MIME type, never from the client filename.
  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "avif";

  const safeDir = dir.replace(/[^a-z0-9-]/gi, "") || "products";
  const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const destDir = path.join(process.cwd(), "public", "uploads", safeDir);

  await mkdir(destDir, { recursive: true });
  await writeFile(
    path.join(destDir, filename),
    Buffer.from(await file.arrayBuffer()),
  );

  return { ok: true, path: `${safeDir}/${filename}` };
}

/** Accepts either an uploaded file or a pasted absolute URL. */
export async function resolveImageInput(
  file: File | null,
  url: string | null,
  dir = "products",
): Promise<UploadResult | null> {
  if (file && file.size > 0) return saveUpload(file, dir);
  const trimmed = url?.trim();
  if (trimmed) {
    if (!/^https?:\/\//i.test(trimmed)) {
      return { ok: false, error: "Image URL must start with http:// or https://" };
    }
    return { ok: true, path: trimmed };
  }
  return null;
}
