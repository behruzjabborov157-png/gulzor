import fs from "node:fs/promises";
import { getAdmin } from "@/lib/auth";
import { resolveMediaPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Serves uploaded images.
 * - products: public, cached forever.
 * - requests (customers' inspiration photos): Gulzor staff only — not florist accounts.
 * - orders (prepared-bouquet photos): reachable only through their unguessable URL on the order page;
 *   never cached by shared caches or indexed.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const file = resolveMediaPath(parts);
  if (!file) return new Response("Not found", { status: 404 });
  if (parts[0] === "requests") {
    const admin = await getAdmin();
    if (!admin || (admin.role !== "owner" && admin.role !== "staff")) return new Response("Not found", { status: 404 });
  }
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": parts[0] === "requests" ? "private, no-store" : parts[0] === "orders" ? "private, max-age=86400" : "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        ...(parts[0] === "products" ? {} : { "X-Robots-Tag": "noindex" }),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
