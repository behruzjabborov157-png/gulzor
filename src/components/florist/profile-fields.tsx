import { formatPhone } from "@/lib/format";

type Shop = {
  name: string;
  nameRu: string | null;
  phone: string;
  telegramUsername: string;
  address: string;
  addressRu: string | null;
  description: string;
  descriptionRu: string | null;
};

/** Public shop profile fields (florist panel and the admin's edit of the platform shop). Wrap in an AdminForm. */
export function ProfileFields({ shop }: { shop: Shop }) {
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
        {field("name", "Do‘kon nomi *", shop.name, { required: true, minLength: 2, maxLength: 80 })}
        {field("nameRu", "Nomi (rus.)", shop.nameRu, { maxLength: 80 })}
        {field("phone", "Telefon *", formatPhone(shop.phone), { required: true, inputMode: "tel" })}
        {field("telegramUsername", "Telegram username", shop.telegramUsername, { placeholder: "dokon_nomi" })}
        {field("address", "Manzil", shop.address, { maxLength: 200 })}
        {field("addressRu", "Manzil (rus.)", shop.addressRu, { maxLength: 200 })}
      </div>
      <div>
        <label htmlFor="p-description" className="label">
          Do‘kon haqida
        </label>
        <textarea id="p-description" name="description" defaultValue={shop.description} rows={4} maxLength={1000} className="field" />
      </div>
      <div>
        <label htmlFor="p-descriptionRu" className="label">
          Do‘kon haqida (rus.)
        </label>
        <textarea id="p-descriptionRu" name="descriptionRu" defaultValue={shop.descriptionRu ?? ""} rows={4} maxLength={1000} className="field" />
      </div>
    </div>
  );
}

