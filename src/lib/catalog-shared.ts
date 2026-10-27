/** Client-safe catalog types and helpers (no database imports). */

export type StockState = "available" | "made_to_order" | "out_of_stock" | "out_of_season";

export const STOCK_LABEL: Record<StockState, string> = {
  available: "Mavjud",
  made_to_order: "Buyurtma asosida",
  out_of_stock: "Hozircha mavjud emas",
  out_of_season: "Mavsumda emas",
};

export function isOrderable(s: StockState) {
  return s === "available" || s === "made_to_order";
}

export type ProductCard = {
  id: number;
  slug: string;
  name: string;
  shortDescription: string;
  image: { url: string; alt: string } | null;
  price: number;
  compareAtPrice: number | null;
  hasOptions: boolean;
  stock: StockState;
  isNew: boolean;
  isPremium: boolean;
  isDemo: boolean;
  isAddon: boolean;
};
