"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductImage } from "@/components/ui/primitives";

export function Gallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-ivory-deep">
        <ProductImage src={current?.url} alt={current?.alt || name} sizes="(max-width: 1024px) 100vw, 50vw" priority />
      </div>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-3" role="tablist" aria-label="Rasmlar">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`${i + 1}-rasm`}
              onClick={() => setActive(i)}
              className={`relative h-20 w-16 overflow-hidden rounded-xl border-2 transition ${i === active ? "border-forest" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
