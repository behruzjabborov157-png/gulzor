import fs from "node:fs/promises";
import { getAdmin } from "@/lib/auth";
import { resolveMediaPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Serves uploaded images. Customer inspiration images ("requests") are visible to admins only. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const file = resolveMediaPath(parts);
  if (!file) return new Response("Not found", { status: 404 });
  if (parts[0] === "requests" && !(await getAdmin())) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": parts[0] === "requests" ? "private, no-store" : "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
