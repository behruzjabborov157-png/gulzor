import type { Metadata } from "next";
import { FavoritesView } from "./view";

export const metadata: Metadata = { title: "Sevimlilar", robots: { index: false } };

export default function FavoritesPage() {
  return (
    <div className="container-page pt-10">
      <h1 className="mb-8 text-4xl sm:text-5xl">Sevimlilar</h1>
      <FavoritesView />
    </div>
  );
}
