import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Serves runtime-uploaded files (product images, receipts, employee photos)
 * from disk on every request.
 *
 * These can't live in `public/`: `next start` snapshots that folder at boot and
 * won't serve files written afterward — a runtime upload 404s, and next/image
 * then returns 400 "not a valid image". Reading from disk here fixes that in
 * dev, `next start` and production alike, with no nginx changes.
 *
 * Primary root is `<cwd>/uploads`; `public/uploads` is kept as a fallback so any
 * legacy files still resolve.
 */
const ROOTS = [
  path.join(process.cwd(), "uploads"),
  path.join(process.cwd(), "public", "uploads"),
];

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments?.length) return new Response("Not found", { status: 404 });

  const rel = segments.join("/");
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return new Response("Not found", { status: 404 }); // images only

  for (const root of ROOTS) {
    const abs = path.join(root, rel);
    // Guard against path traversal escaping the upload root.
    if (abs !== root && !abs.startsWith(root + path.sep)) continue;
    try {
      const buf = await readFile(abs);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": type,
          // Filenames are unique (timestamp + random), so cache hard.
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Try the next root, or fall through to 404.
    }
  }

  return new Response("Not found", { status: 404 });
}
