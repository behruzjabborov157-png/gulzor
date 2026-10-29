import type { MetadataRoute } from "next";

/** Web app manifest: "Add to home screen" and the base for the Android (TWA) app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Gulzor — gul do‘koni",
    short_name: "Gulzor",
    description: "Toshkent bo‘ylab guldastalar va gullarni onlayn buyurtma qilish.",
    lang: "uz",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf6ef",
    theme_color: "#7a1732",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Katalog", url: "/katalog", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Savat", url: "/savat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Buyurtmani kuzatish", url: "/kuzatish", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
