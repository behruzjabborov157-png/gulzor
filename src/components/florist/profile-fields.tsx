import { panelT } from "@/i18n/panel/server";
import { formatPhone } from "@/lib/format";

type Shop = {
  name: string;
  nameRu: string | null;
  nameEn: string | null;
  phone: string;
  telegramUsername: string;
  address: string;
  addressRu: string | null;
  addressEn: string | null;
  description: string;
  descriptionRu: string | null;
  descriptionEn: string | null;
};

/** Public shop profile fields (florist panel and the admin's edit of the platform shop). Wrap in an AdminForm. */
export async function ProfileFields({ shop }: { shop: Shop }) {
  const tt = await panelT();
  const field = (name: string, label: string, value: string | null, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`p-${name}`} className="label">
        {label}
      </label>
      <input id={`p-${name}`} name={name} defaultValue={value ?? ""} className="field py-2.5" {...extra} />
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", tt("Do‘kon nomi *"), shop.name, { required: true, minLength: 2, maxLength: 80 })}
        {field("nameRu", tt("Nomi (rus.)"), shop.nameRu, { maxLength: 80 })}
        {field("nameEn", tt("Nomi (ingl.)"), shop.nameEn, { maxLength: 80 })}
        {field("phone", tt("Telefon *"), formatPhone(shop.phone), { required: true, inputMode: "tel" })}
        {field("telegramUsername", tt("Telegram username"), shop.telegramUsername, { placeholder: "dokon_nomi" })}
        {field("address", tt("Manzil"), shop.address, { maxLength: 200 })}
        {field("addressRu", tt("Manzil (rus.)"), shop.addressRu, { maxLength: 200 })}
        {field("addressEn", tt("Manzil (ingl.)"), shop.addressEn, { maxLength: 200 })}
      </div>
      <div>
        <label htmlFor="p-description" className="label">
          {tt("Do‘kon haqida")}
        </label>
        <textarea id="p-description" name="description" defaultValue={shop.description} rows={4} maxLength={1000} className="field" />
      </div>
      <div>
        <label htmlFor="p-descriptionRu" className="label">
          {tt("Do‘kon haqida (rus.)")}
        </label>
        <textarea id="p-descriptionRu" name="descriptionRu" defaultValue={shop.descriptionRu ?? ""} rows={4} maxLength={1000} className="field" />
      </div>
      <div>
        <label htmlFor="p-descriptionEn" className="label">
          {tt("Do‘kon haqida (ingl.)")}
        </label>
        <textarea id="p-descriptionEn" name="descriptionEn" defaultValue={shop.descriptionEn ?? ""} rows={4} maxLength={1000} className="field" />
      </div>
    </div>
  );
}

