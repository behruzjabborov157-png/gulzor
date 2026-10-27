import type { Metadata } from "next";
import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { deleteAddressAction, logoutAction } from "@/app/actions";
import { EmptyState } from "@/components/ui/primitives";
import { getCustomer } from "@/lib/auth";
import { formatDateISO, formatDateTime, formatPhone, formatUZS } from "@/lib/format";
import { customerOrders, ORDER_STATUS_LABEL } from "@/lib/orders";
import { AuthForms } from "./auth-forms";
import { RepeatOrder } from "./repeat-order";

export const metadata: Metadata = { title: "Shaxsiy kabinet", robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const customer = await getCustomer();
  const { next } = await searchParams;

  if (!customer) {
    return (
      <div className="container-page max-w-md pt-12">
        <h1 className="text-4xl">Shaxsiy kabinet</h1>
        <p className="mt-3 text-muted">
          Hisob shart emas — buyurtmani ro‘yxatdan o‘tmasdan ham berishingiz mumkin. Hisob buyurtmalar tarixi, saqlangan manzillar va sevimlilar uchun qulay.
        </p>
        <AuthForms next={next ?? "/hisob"} />
      </div>
    );
  }

  const db = await getDb();
  const [orders, addresses] = await Promise.all([
    customerOrders(customer.id),
    db.select().from(schema.customerAddresses).where(eq(schema.customerAddresses.customerId, customer.id)),
  ]);
  const items = orders.length
    ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orders.map((o) => o.id)))
    : [];
  const productIds = [...new Set(items.map((i) => i.productId).filter((x): x is number => x != null))];
  const slugRows = productIds.length
    ? await db.select({ id: schema.products.id, slug: schema.products.slug }).from(schema.products).where(inArray(schema.products.id, productIds))
    : [];
  const slugOf = new Map(slugRows.map((r) => [r.id, r.slug]));
  const itemsOf = (orderId: string) => items.filter((i) => i.orderId === orderId && i.productId);

  return (
    <div className="container-page max-w-4xl pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Salom, {customer.name}!</h1>
          <p className="mt-1 text-muted">{formatPhone(customer.phone)}</p>
        </div>
        <form action={logoutAction}>
          <button className="btn-secondary btn-sm">Chiqish</button>
        </form>
      </div>

      <section className="mt-10" aria-labelledby="orders-h">
        <h2 id="orders-h" className="mb-4 text-3xl">Buyurtmalarim</h2>
        {orders.length === 0 ? (
          <EmptyState title="Hali buyurtma yo‘q" action={<Link href="/katalog" className="btn-primary">Katalogga o‘tish</Link>} />
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/buyurtma/${o.number}`} className="font-semibold hover:text-forest">{o.number}</Link>
                  <p className="text-sm text-muted">
                    {formatDateTime(o.createdAt)} · yetkazish {formatDateISO(o.deliveryDate, false)} · {ORDER_STATUS_LABEL[o.status]}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{formatUZS(o.total)}</span>
                  {itemsOf(o.id).length ? (
                    <RepeatOrder
                      items={itemsOf(o.id).map((i) => ({
                        productId: i.productId!,
                        slug: slugOf.get(i.productId!) ?? "",
                        variantId: i.variantId,
                        stems: i.stems,
                        color: i.color,
                        quantity: i.quantity,
                        name: i.productName,
                        variantName: i.variantName,
                        image: i.imageUrl,
                        unitPrice: i.unitPrice,
                        addons: i.addons,
                      }))}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="addr-h">
        <h2 id="addr-h" className="mb-4 text-3xl">Saqlangan manzillar</h2>
        {addresses.length === 0 ? (
          <p className="text-muted">Buyurtma berishda “Manzilni hisobimda saqlash” belgisini qo‘ysangiz, manzil shu yerda paydo bo‘ladi.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="card p-5 text-sm">
                <p className="font-semibold">{a.recipientName}, {formatPhone(a.recipientPhone)}</p>
                <p className="mt-1 text-muted">{[a.district, a.neighborhood, a.address, a.apartment].filter(Boolean).join(", ")}</p>
                <form action={deleteAddressAction.bind(null, a.id)} className="mt-3">
                  <button className="text-danger hover:underline">O‘chirish</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-12 text-sm">
        <Link href="/sevimlilar" className="text-forest underline">Sevimlilar ro‘yxati →</Link>
      </p>
    </div>
  );
}
