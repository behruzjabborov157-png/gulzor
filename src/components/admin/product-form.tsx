"use client";

import { submitWithoutReset } from "@/lib/use-form-submit";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveProductAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/primitives";
import type { schema } from "@/db";
import type { FormState } from "@/lib/form-state";
import { UZ_MONTHS } from "@/lib/format";

type Product = typeof schema.products.$inferSelect;
type Variant = typeof schema.productVariants.$inferSelect;
type Category = typeof schema.categories.$inferSelect;

const KIND_LABEL: Record<Category["kind"], string> = {
  flower: "Gul turlari",
  bouquet_type: "Guldasta turlari",
  occasion: "Munosabatlar",
  collection: "Kolleksiyalar",
};

type VRow = { key: string; id: number | null; name: string; stemCount: string; price: string; compareAtPrice: string; stockQuantity: string; isActive: boolean };

function FieldError({ error }: { error?: string }) {
  return error ? <p className="mt-1 text-sm text-danger">{error}</p> : null;
}

export function ProductForm({ product: p, variants, categoryIds, categories }: { product: Product | null; variants: Variant[]; categoryIds: number[]; categories: Category[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProductAction.bind(null, p?.id ?? null), {});
  const [mode, setMode] = useState<Product["pricingMode"]>(p?.pricingMode ?? "fixed");
  const [rows, setRows] = useState<VRow[]>(
    variants.length
      ? variants.map((v) => ({
          key: String(v.id),
          id: v.id,
          name: v.name,
          stemCount: v.stemCount?.toString() ?? "",
          price: String(v.price),
          compareAtPrice: v.compareAtPrice?.toString() ?? "",
          stockQuantity: v.stockQuantity?.toString() ?? "",
          isActive: v.isActive,
        }))
      : [
          { key: "n1", id: null, name: "Kichik", stemCount: "", price: "", compareAtPrice: "", stockQuantity: "", isActive: true },
          { key: "n2", id: null, name: "O‘rtacha", stemCount: "", price: "", compareAtPrice: "", stockQuantity: "", isActive: true },
          { key: "n3", id: null, name: "Katta", stemCount: "", price: "", compareAtPrice: "", stockQuantity: "", isActive: true },
        ],
  );
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.ok && fileRef.current) fileRef.current.value = "";
  }, [state]);
  const err = (k: string) => state.errors?.[k];
  const text = (name: string, label: string, def: string | number | null | undefined, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`p-${name}`} className="label">{label}</label>
      <input id={`p-${name}`} name={name} defaultValue={def ?? ""} aria-invalid={!!err(name)} className="field py-2.5" {...props} />
      <FieldError error={err(name)} />
    </div>
  );
  const check = (name: string, label: string, def: boolean) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={def} className="h-4 w-4 accent-forest" /> {label}
    </label>
  );

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6">
      {state.message ? <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert> : null}

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">Asosiy</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", "Nomi (o‘zbekcha) *", p?.name, { required: true, maxLength: 120 })}
          {text("slug", "Slug (URL)", p?.slug, { placeholder: "avtomatik", pattern: "[a-z0-9-]*" })}
        </div>
        {text("shortDescription", "Qisqa tavsif", p?.shortDescription, { maxLength: 200 })}
        <div>
          <label htmlFor="p-description" className="label">To‘liq tavsif</label>
          <textarea id="p-description" name="description" defaultValue={p?.description} className="field min-h-28" />
        </div>
        <div>
          <label htmlFor="p-care" className="label">Parvarish bo‘yicha tavsiyalar</label>
          <textarea id="p-care" name="careInstructions" defaultValue={p?.careInstructions} className="field min-h-20" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {text("flowerVarieties", "Gul turlari (vergul bilan)", p?.flowerVarieties.join(", "))}
          {text("stemCount", "Gullar soni", p?.stemCount, { inputMode: "numeric" })}
          {text("sizeLabel", "O‘lcham tavsifi", p?.sizeLabel, { placeholder: "masalan, ~40 sm" })}
        </div>
        {text("colorOptions", "Rang variantlari (ixtiyoriy, vergul bilan)", p?.colorOptions.join(", "), { placeholder: "Qizil, Oq, Pushti" })}
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">Narx</h2>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Narxlash usuli</legend>
          {[
            ["fixed", "Qat’iy narx"],
            ["variants", "O‘lchamlar (Kichik/O‘rtacha/Katta)"],
            ["per_stem", "Donalab (gullar sonini mijoz tanlaydi)"],
          ].map(([v, l]) => (
            <label key={v} className={`chip cursor-pointer ${mode === v ? "chip-active" : ""}`}>
              <input type="radio" name="pricingMode" value={v} checked={mode === v} onChange={() => setMode(v as Product["pricingMode"])} className="sr-only" />
              {l}
            </label>
          ))}
        </fieldset>
        {mode === "fixed" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {text("price", "Narx, so‘m *", p?.price || "", { inputMode: "numeric" })}
            {text("compareAtPrice", "Avvalgi narx (faqat haqiqiy chegirma bo‘lsa)", p?.compareAtPrice, { inputMode: "numeric" })}
          </div>
        ) : null}
        {mode === "per_stem" ? (
          <div className="grid gap-4 sm:grid-cols-4">
            {text("stemPrice", "1 dona narxi *", p?.stemPrice, { inputMode: "numeric" })}
            {text("minStems", "Min. soni *", p?.minStems ?? 5, { inputMode: "numeric" })}
            {text("maxStems", "Maks. soni *", p?.maxStems ?? 101, { inputMode: "numeric" })}
            {text("stemStep", "Qadam (2 = toq sonlar)", p?.stemStep ?? 2, { inputMode: "numeric" })}
          </div>
        ) : null}
        {mode === "variants" ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr><th className="pb-2">Nomi</th><th className="pb-2">Gullar soni</th><th className="pb-2">Narx *</th><th className="pb-2">Avvalgi narx</th><th className="pb-2">Ombor</th><th className="pb-2">Faol</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key}>
                      <td className="pr-2 pb-2"><input type="hidden" name="variant_id" value={r.id ?? ""} /><input name="variant_name" defaultValue={r.name} className="field py-2" aria-label="O‘lcham nomi" /></td>
                      <td className="pr-2 pb-2"><input name="variant_stems" defaultValue={r.stemCount} inputMode="numeric" className="field w-24 py-2" aria-label="Gullar soni" /></td>
                      <td className="pr-2 pb-2"><input name="variant_price" defaultValue={r.price} inputMode="numeric" className="field w-32 py-2" aria-label="Narx" /></td>
                      <td className="pr-2 pb-2"><input name="variant_compare" defaultValue={r.compareAtPrice} inputMode="numeric" className="field w-32 py-2" aria-label="Avvalgi narx" /></td>
                      <td className="pr-2 pb-2"><input name="variant_stock" defaultValue={r.stockQuantity} placeholder="∞" inputMode="numeric" className="field w-20 py-2" aria-label="Ombor" /></td>
                      <td className="pr-2 pb-2"><input type="checkbox" name="variant_active" value={i} defaultChecked={r.isActive} className="h-4 w-4 accent-forest" aria-label="Faol" /></td>
                      <td className="pb-2"><button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="text-danger" aria-label="O‘chirish">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setRows((x) => [...x, { key: `n${Date.now()}`, id: null, name: "", stemCount: "", price: "", compareAtPrice: "", stockQuantity: "", isActive: true }])}>
              + O‘lcham qo‘shish
            </button>
            <FieldError error={err("variants")} />
          </div>
        ) : null}
        {p ? <p className="text-xs text-muted">Narx o‘zgartirilganda “narx yangilangan” sanasi avtomatik yangilanadi va saytda ko‘rsatiladi.</p> : null}
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">Mavjudlik</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="p-status" className="label">Holat</label>
            <select id="p-status" name="status" defaultValue={p?.status ?? "draft"} className="field py-2.5">
              <option value="active">Faol (saytda)</option>
              <option value="draft">Qoralama</option>
              <option value="archived">Arxiv</option>
            </select>
          </div>
          <div>
            <label htmlFor="p-av" className="label">Mavjudlik</label>
            <select id="p-av" name="availability" defaultValue={p?.availability ?? "in_stock"} className="field py-2.5">
              <option value="in_stock">Mavjud</option>
              <option value="made_to_order">Buyurtma asosida</option>
              <option value="out_of_stock">Mavjud emas</option>
            </select>
          </div>
          {text("stockQuantity", "Ombordagi soni (bo‘sh = hisobsiz)", p?.stockQuantity, { inputMode: "numeric", placeholder: "∞" })}
          {text("prepTimeMinutes", "Tayyorlash vaqti (daqiqa)", p?.prepTimeMinutes ?? 60, { inputMode: "numeric" })}
        </div>
        <fieldset>
          <legend className="label">Mavsumiy oylar (hech biri tanlanmasa — yil bo‘yi)</legend>
          <div className="flex flex-wrap gap-2">
            {UZ_MONTHS.map((m, i) => (
              <label key={m} className="chip cursor-pointer gap-1.5 py-1 text-xs has-[:checked]:border-forest has-[:checked]:bg-forest has-[:checked]:text-ivory">
                <input type="checkbox" name="seasonalMonths" value={i + 1} defaultChecked={p?.seasonalMonths.includes(i + 1)} className="sr-only" />
                {m}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {check("deliveryEligible", "Yetkazib berish mumkin", p?.deliveryEligible ?? true)}
          {check("pickupEligible", "Olib ketish mumkin", p?.pickupEligible ?? true)}
          {check("isAddon", "Qo‘shimcha sovg‘a (guldastaga qo‘shiladi)", p?.isAddon ?? false)}
          {check("isFeatured", "Tavsiya etilgan", p?.isFeatured ?? false)}
          {check("isNew", "Yangi", p?.isNew ?? false)}
          {check("isPremium", "Premium", p?.isPremium ?? false)}
          {check("isDemo", "Namuna (demo) mahsulot", p?.isDemo ?? false)}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">Kategoriyalar</h2>
        {(["flower", "bouquet_type", "occasion", "collection"] as const).map((kind) => (
          <fieldset key={kind}>
            <legend className="label">{KIND_LABEL[kind]}</legend>
            <div className="flex flex-wrap gap-2">
              {categories.filter((c) => c.kind === kind).map((c) => (
                <label key={c.id} className="chip cursor-pointer gap-1.5 py-1 text-xs has-[:checked]:border-forest has-[:checked]:bg-forest has-[:checked]:text-ivory">
                  <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={categoryIds.includes(c.id)} className="sr-only" />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="max-w-xs">
          <label htmlFor="p-primary" className="label">Asosiy kategoriya</label>
          <select id="p-primary" name="primaryCategoryId" defaultValue={p?.primaryCategoryId ?? ""} className="field py-2.5">
            <option value="">Birinchi tanlangan</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">Rasmlar</h2>
        <p className="text-sm text-muted">Faqat o‘zingizga tegishli yoki foydalanishga ruxsat olingan rasmlarni yuklang. JPG/PNG/WEBP, 6 MB gacha; avtomatik siqiladi va metama’lumotlar (GPS) o‘chiriladi.</p>
        {p?.images.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {p.images.map((img) => (
              <li key={img.url} className="space-y-2">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-ivory-deep">
                  <Image src={img.url} alt={img.alt} fill sizes="200px" className="object-cover" />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="keepImage" value={img.url} defaultChecked className="accent-forest" /> Saqlash
                </label>
                <input name="keepImageAlt" defaultValue={img.alt} className="field px-2 py-1.5 text-xs" aria-label="Rasm tavsifi (alt)" />
                {img.credit ? <p className="text-[10px] text-muted">© {img.credit}, {img.license}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <label htmlFor="p-new" className="label">Yangi rasmlar qo‘shish</label>
          <input ref={fileRef} id="p-new" name="newImages" type="file" multiple accept="image/jpeg,image/png,image/webp" className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-forest/10 file:px-4 file:py-2 file:text-forest" />
          <FieldError error={err("newImages")} />
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">SEO</h2>
        {text("seoTitle", "Sahifa sarlavhasi (title)", p?.seoTitle, { maxLength: 70 })}
        {text("seoDescription", "Meta tavsif", p?.seoDescription, { maxLength: 170 })}
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button className="btn-primary px-10 shadow-lg" disabled={pending}>{pending ? "Saqlanmoqda…" : "Saqlash"}</button>
      </div>
    </form>
  );
}
