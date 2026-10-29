"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Bosh sahifa", owner: false },
  { href: "/admin/buyurtmalar", label: "Buyurtmalar", owner: false },
  { href: "/admin/floristlar", label: "Do‘konlar", owner: false },
  { href: "/admin/mahsulotlar", label: "Mahsulotlar", owner: false },
  { href: "/admin/kategoriyalar", label: "Kategoriyalar", owner: false },
  { href: "/admin/sorovlar", label: "So‘rovlar", owner: false },
  { href: "/admin/murojaatlar", label: "Murojaatlar", owner: false },
  { href: "/admin/sharhlar", label: "Sharhlar", owner: false },
  { href: "/admin/tahlil", label: "Tahlil", owner: false },
  { href: "/admin/yetkazib-berish", label: "Yetkazib berish", owner: true },
  { href: "/admin/komissiya", label: "Komissiya", owner: true },
  { href: "/admin/kuponlar", label: "Promokodlar", owner: true },
  { href: "/admin/import", label: "Import / eksport", owner: true },
  { href: "/admin/sozlamalar", label: "Sozlamalar", owner: true },
  { href: "/admin/jurnal", label: "Jurnal", owner: true },
];

type Badges = { newOrders?: number; pendingShops?: number; openDisputes?: number; pendingReviews?: number };

export function AdminNav({ owner, newOrders = 0, pendingShops = 0, openDisputes = 0, pendingReviews = 0 }: { owner: boolean } & Badges) {
  const badges: Record<string, [number, string]> = {
    "/admin/buyurtmalar": [newOrders, "ta yangi"],
    "/admin/floristlar": [pendingShops, "ta yangi ariza"],
    "/admin/murojaatlar": [openDisputes, "ta ochiq murojaat"],
    "/admin/sharhlar": [pendingReviews, "ta sharh tekshiruvda"],
  };
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
      {ITEMS.filter((i) => owner || !i.owner).map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-wine text-ivory" : "text-charcoal hover:bg-cream"}`}
          >
            {i.label}
            {badges[i.href]?.[0] ? (
              <span className="rounded-full bg-fuchsia px-2 py-0.5 text-[11px] font-bold text-white" aria-label={`${badges[i.href][0]} ${badges[i.href][1]}`}>
                {badges[i.href][0]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
