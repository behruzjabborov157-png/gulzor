"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/florist", label: "Bosh sahifa" },
  { href: "/florist/buyurtmalar", label: "Buyurtmalar" },
  { href: "/florist/mahsulotlar", label: "Mahsulotlar" },
  { href: "/florist/hududlar", label: "Yetkazib berish" },
  { href: "/florist/sharhlar", label: "Sharhlar" },
  { href: "/florist/hisobot", label: "Savdo va komissiya" },
  { href: "/florist/profil", label: "Do‘kon profili" },
];

export function FloristNav({ newOrders = 0 }: { newOrders?: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Florist" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
      {ITEMS.map((i) => {
        const active = i.href === "/florist" ? path === "/florist" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-wine text-ivory" : "text-charcoal hover:bg-cream"}`}
          >
            {i.label}
            {i.href === "/florist/buyurtmalar" && newOrders > 0 ? (
              <span className="rounded-full bg-fuchsia px-2 py-0.5 text-[11px] font-bold text-white" aria-label={`${newOrders} ta yangi`}>
                {newOrders}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
