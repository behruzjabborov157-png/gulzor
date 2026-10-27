"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Bosh sahifa", owner: false },
  { href: "/admin/buyurtmalar", label: "Buyurtmalar", owner: false },
  { href: "/admin/mahsulotlar", label: "Mahsulotlar", owner: false },
  { href: "/admin/kategoriyalar", label: "Kategoriyalar", owner: false },
  { href: "/admin/sorovlar", label: "So‘rovlar", owner: false },
  { href: "/admin/yetkazib-berish", label: "Yetkazib berish", owner: true },
  { href: "/admin/kuponlar", label: "Promokodlar", owner: true },
  { href: "/admin/import", label: "Import / eksport", owner: true },
  { href: "/admin/sozlamalar", label: "Sozlamalar", owner: true },
];

export function AdminNav({ owner }: { owner: boolean }) {
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
            className={`shrink-0 rounded-lg px-3 py-2 text-sm ${active ? "bg-forest text-ivory" : "text-charcoal hover:bg-ivory-deep"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
