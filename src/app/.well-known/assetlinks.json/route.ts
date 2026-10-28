import { buildAssetLinks } from "@/lib/twa";

export const dynamic = "force-dynamic";

export function GET() {
  const links = buildAssetLinks(process.env.TWA_PACKAGE_NAME, process.env.TWA_SHA256_FINGERPRINTS);
  if (!links) return new Response("Not found", { status: 404 });
  return Response.json(links, { headers: { "Cache-Control": "public, max-age=3600" } });
}
