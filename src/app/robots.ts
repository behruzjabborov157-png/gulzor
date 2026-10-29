import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/settings";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/florist/royxatdan-otish"], disallow: ["/admin", "/florist", "/api", "/media/requests", ...["/savat", "/buyurtma", "/hisob", "/sevimlilar"].flatMap((p) => [p, `/ru${p}`])] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
