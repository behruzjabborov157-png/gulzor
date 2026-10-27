import type { Metadata } from "next";
import { TrackForm } from "./track-form";

export const metadata: Metadata = {
  title: "Buyurtmani kuzatish",
  description: "Buyurtma raqami va telefon raqami orqali gul buyurtmangiz holatini bilib oling.",
};

export default function TrackPage() {
  return (
    <div className="container-page max-w-xl pt-12">
      <h1 className="text-4xl sm:text-5xl">Buyurtmani kuzatish</h1>
      <p className="mt-3 text-muted">Buyurtma raqami (masalan, GZ-261026-1234) va buyurtma berishda ko‘rsatilgan telefon raqamini kiriting.</p>
      <div className="card mt-8 p-6">
        <TrackForm />
      </div>
    </div>
  );
}
