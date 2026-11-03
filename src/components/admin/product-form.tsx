"use client";

import { usePanelT } from "@/i18n/panel/client";
import { submitWithoutReset } from "@/lib/use-form-submit";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveProductAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/primitives";
import type { schema } from "@/db";
import type { FormState } from "@/lib/form-state";
import { monthNames } from "@/lib/format";
import { usePanelLocale } from "@/i18n/panel/client";

type Product = typeof schema.products.$inferSelect;
type Variant = typeof schema.productVariants.$inferSelect;
type Category = typeof schema.categories.$inferSelect;

const KIND_LABEL: Record<Category["kind"], string> = {
  flower: "Gul turlari",
  bouquet_type: "Guldasta turlari",
  occasion: "Munosabatlar",
  collection: "Kolleksiyalar",
};

type VRow = { key: string; id: number | null; name: string; nameRu: string; nameEn: string; stemCount: string; price: string; compareAtPrice: string; stockQuantity: string; isActive: boolean };

function FieldError({ error }: { error?: string }) {
  return error ? <p className="mt-1 text-sm text-danger">{error}</p> : null;
}

export function ProductForm({
  product: p,
  variants,
  categoryIds,
  categories,
  saveAction = saveProductAction,
  floristMode = false,
}: {
  product: Product | null;
  variants: Variant[];
  categoryIds: number[];
  categories: Category[];
  /** Server action that saves (admin by default; the florist panel passes its own, scoped one). */
  saveAction?: (productId: number | null, state: FormState, form: FormData) => Promise<FormState>;
  /** Florists don't see Gulzor's curation flags (demo, featured, premium). */
  floristMode?: boolean;
}) {
  const tt = usePanelT();
  const [state, action, pending] = useActionState<FormState, FormData>(saveAction.bind(null, p?.id ?? null), {});
  const [mode, setMode] = useState<Product["pricingMode"]>(p?.pricingMode ?? "fixed");
  const [rows, setRows] = useState<VRow[]>(
    variants.length
      ? variants.map((v) => ({
          key: String(v.id),
          id: v.id,
          name: v.name,
          nameRu: v.nameRu ?? "",
          nameEn: v.nameEn ?? "",
          stemCount: v.stemCount?.toString() ?? "",
          price: String(v.price),
          compareAtPrice: v.compareAtPrice?.toString() ?? "",
          stockQuantity: v.stockQuantity?.toString() ?? "",
          isActive: v.isActive,
        }))
      : [
          { key: "n1", id: null, name: "Kichik", nameRu: "Маленький", nameEn: "Small", stemCount: "", price: "", compareAtPrice: "", stockQuantity: "", isActive: true },
          { key: "n2", id: null, name: "O‘rtacha", nameRu: "Средний", nameEn: "Medium", stemCount: "", price: "", compareAtPrice: "", stockQuantity: "", isActive: true },
          { key: "n3", id: null, name: "Katta", nameRu: "Большой", nameEn: "Large", stemCount: "", price: "", compareAtPrice: "", stockQuantity: "", isActive: true },
        ],
  );
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.ok && fileRef.current) fileRef.current.value = "";
  }, [state]);
  const months = monthNames(usePanelLocale());
  const err = (k: string) => { const m = state.errors?.[k]; return m ? tt(m) : undefined; };
  const text = (name: string, label: string, def: string | number | null | undefined, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`p-${name}`} className="label">{label}</label>
      <input id={`p-${name}`} name={name} defaultValue={def ?? ""} aria-invalid={!!err(name)} className="field py-2.5" {...props} />
      <FieldError error={err(name)} />
    </div>
  );
  const check = (name: string, label: string, def: boolean) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={def} className="h-4 w-4 accent-wine" /> {label}
    </label>
  );

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6">
      {state.message ? <Alert tone={state.ok ? "success" : "error"}>{tt(state.message)}</Alert> : null}

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">{tt("Asosiy")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", tt("Nomi (o‘zbekcha) *"), p?.name, { required: true, maxLength: 120 })}
          {text("slug", tt("Slug (URL)"), p?.slug, { placeholder: "avtomatik", pattern: "[a-z0-9-]*" })}
        </div>
        {text("shortDescription", tt("Qisqa tavsif"), p?.shortDescription, { maxLength: 200 })}
        <div>
          <label htmlFor="p-description" className="label">{tt("To‘liq tavsif")}</label>
          <textarea id="p-description" name="description" defaultValue={p?.description} className="field min-h-28" />
        </div>
        <div>
          <label htmlFor="p-care" className="label">{tt("Parvarish bo‘yicha tavsiyalar")}</label>
          <textarea id="p-care" name="careInstructions" defaultValue={p?.careInstructions} className="field min-h-20" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {text("flowerVarieties", tt("Gul turlari (vergul bilan)"), p?.flowerVarieties.join(", "))}
          {text("stemCount", tt("Gullar soni"), p?.stemCount, { inputMode: "numeric" })}
          {text("sizeLabel", tt("O‘lcham tavsifi"), p?.sizeLabel, { placeholder: "masalan, ~40 sm" })}
        </div>
        {text("colorOptions", tt("Rang variantlari (ixtiyoriy, vergul bilan)"), p?.colorOptions.join(", "), { placeholder: tt("Qizil, Oq, Pushti") })}
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">{tt("Narx")}</h2>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">{tt("Narxlash usuli")}</legend>
          {[
            ["fixed", tt("Qat’iy narx")],
            ["variants", tt("O‘lchamlar (Kichik/O‘rtacha/Katta)")],
            ["per_stem", tt("Donalab (gullar sonini mijoz tanlaydi)")],
          ].map(([v, l]) => (
            <label key={v} className={`chip cursor-pointer ${mode === v ? "chip-active" : ""}`}>
              <input type="radio" name="pricingMode" value={v} checked={mode === v} onChange={() => setMode(v as Product["pricingMode"])} className="sr-only" />
              {l}
            </label>
          ))}
        </fieldset>
        {mode === "fixed" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {text("price", tt("Narx, so‘m *"), p?.price || "", { inputMode: "numeric" })}
            {text("compareAtPrice", tt("Avvalgi narx (faqat haqiqiy chegirma bo‘lsa)"), p?.compareAtPrice, { inputMode: "numeric" })}
          </div>
        ) : null}
        {mode === "per_stem" ? (
          <div className="grid gap-4 sm:grid-cols-4">
            {text("stemPrice", tt("1 dona narxi *"), p?.stemPrice, { inputMode: "numeric" })}
            {text("minStems", tt("Min. soni *"), p?.minStems ?? 5, { inputMode: "numeric" })}
            {text("maxStems", tt("Maks. soni *"), p?.maxStems ?? 101, { inputMode: "numeric" })}
            {text("stemStep", tt("Qadam (2 = toq sonlar)"), p?.stemStep ?? 2, { inputMode: "numeric" })}
          </div>
        ) : null}
        {mode === "variants" ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr><th className="pb-2">{tt("Nomi")}</th><th className="pb-2">{tt("Nomi (rus.)")}</th><th className="pb-2">{tt("Nomi (ingl.)")}</th><th className="pb-2">{tt("Gullar soni")}</th><th className="pb-2">{tt("Narx *")}</th><th className="pb-2">{tt("Avvalgi narx")}</th><th className="pb-2">{tt("Ombor")}</th><th className="pb-2">{tt("Faol")}</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key}>
                      <td className="pr-2 pb-2"><input type="hidden" name="variant_id" value={r.id ?? ""} /><input name="variant_name" defaultValue={r.name} className="field py-2" aria-label={tt("O‘lcham nomi")} /></td>
                      <td className="pr-2 pb-2"><input name="variant_name_ru" defaultValue={r.nameRu} className="field py-2" aria-label={tt("O‘lcham nomi (rus tilida)")} /></td>
                      <td className="pr-2 pb-2"><input name="variant_name_en" defaultValue={r.nameEn} className="field py-2" aria-label={tt("O‘lcham nomi (ingliz tilida)")} /></td>
                      <td className="pr-2 pb-2"><input name="variant_stems" defaultValue={r.stemCount} inputMode="numeric" className="field w-24 py-2" aria-label={tt("Gullar soni")} /></td>
                      <td className="pr-2 pb-2"><input name="variant_price" defaultValue={r.price} inputMode="numeric" className="field w-32 py-2" aria-label={tt("Narx")} /></td>
                      <td className="pr-2 pb-2"><input name="variant_compare" defaultValue={r.compareAtPrice} inputMode="numeric" className="field w-32 py-2" aria-label={tt("Avvalgi narx")} /></td>
                      <td className="pr-2 pb-2"><input name="variant_stock" defaultValue={r.stockQuantity} placeholder="∞" inputMode="numeric" className="field w-20 py-2" aria-label={tt("Ombor")} /></td>
                      <td className="pr-2 pb-2"><input type="checkbox" name="variant_active" value={i} defaultChecked={r.isActive} className="h-4 w-4 accent-wine" aria-label={tt("Faol")} /></td>
                      <td className="pb-2"><button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="text-danger" aria-label={tt("O‘chirish")}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setRows((x) => [...x, { key: `n${Date.now()}`, id: null, name: "", nameRu: "", nameEn: "", stemCount: "", price: "", compareAtPrice: "", stockQuantity: "", isActive: true }])}>
              {tt("+ O‘lcham qo‘shish")}
            </button>
            <FieldError error={err("variants")} />
          </div>
        ) : null}
        {p ? <p className="text-xs text-muted">{tt("Narx o‘zgartirilganda “narx yangilangan” sanasi avtomatik yangilanadi va saytda ko‘rsatiladi.")}</p> : null}
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">{tt("Mavjudlik")}</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="p-status" className="label">{tt("Holat")}</label>
            <select id="p-status" name="status" defaultValue={p?.status ?? "draft"} className="field py-2.5">
              <option value="active">{tt("Faol (saytda)")}</option>
              <option value="draft">{tt("Qoralama")}</option>
              <option value="archived">{tt("Arxiv")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="p-av" className="label">{tt("Mavjudlik")}</label>
            <select id="p-av" name="availability" defaultValue={p?.availability ?? "in_stock"} className="field py-2.5">
              <option value="in_stock">{tt("Mavjud")}</option>
              <option value="made_to_order">{tt("Buyurtma asosida")}</option>
              <option value="out_of_stock">{tt("Mavjud emas")}</option>
            </select>
          </div>
          {text("stockQuantity", tt("Ombordagi soni (bo‘sh = hisobsiz)"), p?.stockQuantity, { inputMode: "numeric", placeholder: "∞" })}
          {text("prepTimeMinutes", tt("Tayyorlash vaqti (daqiqa)"), p?.prepTimeMinutes ?? 60, { inputMode: "numeric" })}
        </div>
        <fieldset>
          <legend className="label">{tt("Mavsumiy oylar (hech biri tanlanmasa — yil bo‘yi)")}</legend>
          <div className="flex flex-wrap gap-2">
            {months.map((m, i) => (
              <label key={m} className="chip cursor-pointer gap-1.5 py-1 text-xs has-[:checked]:border-wine has-[:checked]:bg-wine has-[:checked]:text-ivory">
                <input type="checkbox" name="seasonalMonths" value={i + 1} defaultChecked={p?.seasonalMonths.includes(i + 1)} className="sr-only" />
                {m}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {check("deliveryEligible", tt("Yetkazib berish mumkin"), p?.deliveryEligible ?? true)}
          {check("pickupEligible", tt("Olib ketish mumkin"), p?.pickupEligible ?? true)}
          {check("isAddon", tt("Qo‘shimcha sovg‘a (guldastaga qo‘shiladi)"), p?.isAddon ?? false)}
          {floristMode ? null : check("isFeatured", tt("Tavsiya etilgan"), p?.isFeatured ?? false)}
          {check("isNew", tt("Yangi"), p?.isNew ?? false)}
          {floristMode ? null : check("isPremium", tt("Premium"), p?.isPremium ?? false)}
          {floristMode ? null : check("isDemo", tt("Namuna (demo) mahsulot"), p?.isDemo ?? false)}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">{tt("Kategoriyalar")}</h2>
        {(["flower", "bouquet_type", "occasion", "collection"] as const).map((kind) => (
          <fieldset key={kind}>
            <legend className="label">{tt(KIND_LABEL[kind])}</legend>
            <div className="flex flex-wrap gap-2">
              {categories.filter((c) => c.kind === kind).map((c) => (
                <label key={c.id} className="chip cursor-pointer gap-1.5 py-1 text-xs has-[:checked]:border-wine has-[:checked]:bg-wine has-[:checked]:text-ivory">
                  <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={categoryIds.includes(c.id)} className="sr-only" />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="max-w-xs">
          <label htmlFor="p-primary" className="label">{tt("Asosiy kategoriya")}</label>
          <select id="p-primary" name="primaryCategoryId" defaultValue={p?.primaryCategoryId ?? ""} className="field py-2.5">
            <option value="">{tt("Birinchi tanlangan")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">{tt("Rasmlar")}</h2>
        <p className="text-sm text-muted">{tt("Faqat o‘zingizga tegishli yoki foydalanishga ruxsat olingan rasmlarni yuklang. JPG/PNG/WEBP, 6 MB gacha; avtomatik siqiladi va metama’lumotlar (GPS) o‘chiriladi.")}</p>
        {p?.images.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {p.images.map((img) => (
              <li key={img.url} className="space-y-2">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-cream">
                  <Image src={img.url} alt={img.alt} fill sizes="200px" className="object-cover" />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="keepImage" value={img.url} defaultChecked className="accent-wine" />{" "}{tt("Saqlash")}
                </label>
                <input name="keepImageAlt" defaultValue={img.alt} className="field px-2 py-1.5 text-xs" aria-label={tt("Rasm tavsifi (alt)")} />
                {img.credit ? <p className="text-[10px] text-muted">© {img.credit}, {img.license}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <label htmlFor="p-new" className="label">{tt("Yangi rasmlar qo‘shish")}</label>
          <input ref={fileRef} id="p-new" name="newImages" type="file" multiple accept="image/jpeg,image/png,image/webp" className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-wine/10 file:px-4 file:py-2 file:text-wine" />
          <FieldError error={err("newImages")} />
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-2xl">{tt("Rus tilidagi versiya")}</h2>
          <p className="mt-1 text-sm text-muted">{tt("Saytning rus tilidagi sahifasida ko‘rsatiladi. Bo‘sh qoldirilgan maydonlar o‘rniga o‘zbekcha matn chiqadi.")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("nameRu", tt("Nomi (rus.)"), p?.nameRu, { maxLength: 120, lang: "ru" })}
          {text("sizeLabelRu", tt("O‘lcham tavsifi (rus.)"), p?.sizeLabelRu, { lang: "ru" })}
        </div>
        {text("shortDescriptionRu", tt("Qisqa tavsif (rus.)"), p?.shortDescriptionRu, { maxLength: 200, lang: "ru" })}
        <div>
          <label htmlFor="p-descriptionRu" className="label">{tt("To‘liq tavsif (rus.)")}</label>
          <textarea id="p-descriptionRu" name="descriptionRu" lang="ru" defaultValue={p?.descriptionRu ?? ""} className="field min-h-28" />
        </div>
        <div>
          <label htmlFor="p-careRu" className="label">{tt("Parvarish (rus.)")}</label>
          <textarea id="p-careRu" name="careInstructionsRu" lang="ru" defaultValue={p?.careInstructionsRu ?? ""} className="field min-h-20" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("flowerVarietiesRu", tt("Gul turlari (rus., vergul bilan)"), p?.flowerVarietiesRu.join(", "), { lang: "ru" })}
          {text("colorOptionsRu", tt("Rang variantlari (rus., o‘zbekcha bilan bir xil tartibda)"), p?.colorOptionsRu.join(", "), { lang: "ru", placeholder: tt("Красный, Белый, Розовый") })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("seoTitleRu", tt("SEO sarlavha (rus.)"), p?.seoTitleRu, { maxLength: 70, lang: "ru" })}
          {text("seoDescriptionRu", tt("SEO tavsif (rus.)"), p?.seoDescriptionRu, { maxLength: 170, lang: "ru" })}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-2xl">{tt("Ingliz tilidagi versiya")}</h2>
          <p className="mt-1 text-sm text-muted">{tt("Saytning ingliz tilidagi sahifasida (/en) ko‘rsatiladi. Bo‘sh qoldirilgan maydonlar o‘rniga o‘zbekcha matn chiqadi.")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("nameEn", tt("Nomi (ingl.)"), p?.nameEn, { maxLength: 120, lang: "en" })}
          {text("sizeLabelEn", tt("O‘lcham tavsifi (ingl.)"), p?.sizeLabelEn, { lang: "en" })}
        </div>
        {text("shortDescriptionEn", tt("Qisqa tavsif (ingl.)"), p?.shortDescriptionEn, { maxLength: 200, lang: "en" })}
        <div>
          <label htmlFor="p-descriptionEn" className="label">{tt("To‘liq tavsif (ingl.)")}</label>
          <textarea id="p-descriptionEn" name="descriptionEn" lang="en" defaultValue={p?.descriptionEn ?? ""} className="field min-h-28" />
        </div>
        <div>
          <label htmlFor="p-careEn" className="label">{tt("Parvarish (ingl.)")}</label>
          <textarea id="p-careEn" name="careInstructionsEn" lang="en" defaultValue={p?.careInstructionsEn ?? ""} className="field min-h-20" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("flowerVarietiesEn", tt("Gul turlari (ingl., vergul bilan)"), p?.flowerVarietiesEn.join(", "), { lang: "en" })}
          {text("colorOptionsEn", tt("Rang variantlari (ingl., o‘zbekcha bilan bir xil tartibda)"), p?.colorOptionsEn.join(", "), { lang: "en", placeholder: tt("Red, White, Pink") })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("seoTitleEn", tt("SEO sarlavha (ingl.)"), p?.seoTitleEn, { maxLength: 70, lang: "en" })}
          {text("seoDescriptionEn", tt("SEO tavsif (ingl.)"), p?.seoDescriptionEn, { maxLength: 170, lang: "en" })}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">{tt("SEO")}</h2>
        {text("seoTitle", tt("Sahifa sarlavhasi (title)"), p?.seoTitle, { maxLength: 70 })}
        {text("seoDescription", tt("Meta tavsif"), p?.seoDescription, { maxLength: 170 })}
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button className="btn-primary px-10 shadow-lg" disabled={pending}>{pending ? tt("Saqlanmoqda…") : tt("Saqlash")}</button>
      </div>
    </form>
  );
}
