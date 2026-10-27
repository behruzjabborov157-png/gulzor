import Link from "next/link";
import { Logo } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <Link href="/" aria-label="Bosh sahifa">
        <Logo />
      </Link>
      <h1 className="mt-10 text-5xl">Sahifa topilmadi</h1>
      <p className="mt-3 max-w-md text-muted">Ehtimol, havola eskirgan yoki mahsulot sotuvdan olingan. Katalogdan boshqa guldastalarni ko‘ring.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/katalog" className="btn-primary">Katalog</Link>
        <Link href="/" className="btn-secondary">Bosh sahifa</Link>
      </div>
    </div>
  );
}
