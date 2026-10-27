import type { Metadata } from "next";
import { getCategories } from "@/lib/catalog";
import { addDaysISO, tashkentNow } from "@/lib/time";
import { CustomRequestForm } from "./form";

export const metadata: Metadata = {
  title: "Maxsus guldasta buyurtma qilish",
  description: "O‘zingiz xohlagan guldastani tasvirlab bering yoki namunaviy rasm yuboring — florist siz bilan bog‘lanib, narx va muddatni kelishadi.",
};

export default async function CustomPage() {
  const occasions = await getCategories("occasion");
  const today = tashkentNow().date;
  return (
    <div className="container-page max-w-2xl pt-12">
      <p className="eyebrow mb-3">Individual buyurtma</p>
      <h1 className="text-4xl sm:text-5xl">Maxsus guldasta</h1>
      <p className="mt-3 text-muted">
        Katalogda kerakli guldasta topilmadimi? Istaklaringizni yozing — florist siz bilan bog‘lanib, tarkib, narx va yetkazib berish vaqtini kelishib oladi. So‘rov
        qoldirish bepul va hech narsaga majburlamaydi.
      </p>
      <div className="card mt-8 p-6 sm:p-8">
        <CustomRequestForm occasions={occasions.map((o) => o.name)} minDate={today} maxDate={addDaysISO(today, 90)} />
      </div>
    </div>
  );
}
