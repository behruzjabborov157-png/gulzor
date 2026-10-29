import Image from "next/image";
import { AdminForm } from "@/components/admin/admin-form";
import type { FormState } from "@/lib/form-state";
import { MAX_ORDER_PHOTOS } from "@/lib/trust";

/** Photos of the prepared bouquet with an upload form (florist panel and admin order pages). */
export function OrderPhotos({
  photos,
  action,
  canUpload,
}: {
  photos: { id: number; url: string }[];
  action: (state: FormState, form: FormData) => Promise<FormState>;
  canUpload: boolean;
}) {
  return (
    <section className="card p-5 text-sm" aria-labelledby="order-photos-h">
      <h2 id="order-photos-h" className="mb-1 text-2xl">
        Tayyor guldasta rasmi
      </h2>
      <p className="mb-4 text-muted">Yetkazishdan oldin guldastani suratga oling — mijoz rasmni buyurtma sahifasida ko‘radi.</p>
      {photos.length ? (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-cream">
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                <Image src={p.url} alt={`Tayyor guldasta, ${i + 1}-rasm`} fill sizes="200px" className="object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {canUpload && photos.length < MAX_ORDER_PHOTOS ? (
        <AdminForm action={action} submitLabel="Rasmni yuklash" resetOnSuccess>
          <label htmlFor="order-photo" className="label">
            Rasm (JPG, PNG, WEBP, 6 MB gacha)
          </label>
          <input id="order-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="block text-sm" />
        </AdminForm>
      ) : !canUpload && !photos.length ? (
        <p className="text-muted">Rasmni buyurtma qabul qilingandan keyin yuklash mumkin.</p>
      ) : null}
    </section>
  );
}
