import { panelT } from "@/i18n/panel/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/primitives";
import { getAdmin } from "@/lib/auth";
import { LoginForm } from "./form";
import { PanelLanguage } from "@/components/admin/panel-language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await panelT())("Admin — kirish"), robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const tt = await panelT();
  if (await getAdmin()) redirect("/admin");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="flex items-center justify-between">
          <Logo />
          <PanelLanguage />
        </div>
        <h1 className="mt-6 text-3xl">{tt("Boshqaruv paneli")}</h1>
        <p className="mt-1 text-sm text-muted">{tt("Faqat do‘kon xodimlari uchun.")}</p>
        <LoginForm />
      </div>
    </div>
  );
}
