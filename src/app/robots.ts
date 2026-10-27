import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/settings";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/savat", "/buyurtma", "/hisob", "/sevimlilar", "/media/requests"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
