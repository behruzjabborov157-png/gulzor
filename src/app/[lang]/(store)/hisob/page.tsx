import type { Metadata } from "next";
import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { deleteAddressAction, logoutAction } from "@/app/actions";
import { EmptyState } from "@/components/ui/primitives";
import { fmt, localePath, pick } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { getLocale } from "@/i18n/server";
import { getCustomer } from "@/lib/auth";
import { formatDateISO, formatDateTime, formatPhone, formatUZS } from "@/lib/format";
import { customerOrders } from "@/lib/orders";
import { AuthForms } from "./auth-forms";
import { RepeatOrder } from "./repeat-order";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDict(await getLocale()).meta.account, robots: { index: false } };
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const locale = await getLocale();
  const dict = getDict(locale);
  const t = dict.account;
  const lp = (p: string) => localePath(locale, p);
  const customer = await getCustomer();
  const { next } = await searchParams;

  if (!customer) {
    return (
      <div className="container-page max-w-md pt-12">
        <h1 className="text-4xl">{t.title}</h1>
        <p className="mt-3 text-muted">{t.intro}</p>
        <AuthForms next={next ?? lp("/hisob")} />
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
  const productRows = productIds.length
    ? await db
        .select({ id: schema.products.id, slug: schema.products.slug, nameRu: schema.products.nameRu })
        .from(schema.products)
        .where(inArray(schema.products.id, productIds))
    : [];
  const productOf = new Map(productRows.map((r) => [r.id, r]));
  const itemsOf = (orderId: string) => items.filter((i) => i.orderId === orderId && i.productId);

  return (
    <div className="container-page max-w-4xl pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{fmt(t.hello, { name: customer.name })}</h1>
          <p className="mt-1 text-muted">{formatPhone(customer.phone)}</p>
        </div>
        <form action={logoutAction}>
          <button className="btn-secondary btn-sm">{t.logout}</button>
        </form>
      </div>

      <section className="mt-10" aria-labelledby="orders-h">
        <h2 id="orders-h" className="mb-4 text-3xl">
          {t.orders}
        </h2>
        {orders.length === 0 ? (
          <EmptyState
            title={t.noOrders}
            action={
              <Link href={lp("/katalog")} className="btn-primary">
                {t.toCatalog}
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={lp(`/buyurtma/${o.number}`)} className="font-semibold hover:text-forest">
                    {o.number}
                  </Link>
                  <p className="text-sm text-muted">
                    {fmt(t.orderLine, {
                      created: formatDateTime(o.createdAt),
                      date: formatDateISO(o.deliveryDate, false, locale),
                      status: dict.order.statuses[o.status],
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{formatUZS(o.total, locale)}</span>
                  {itemsOf(o.id).length ? (
                    <RepeatOrder
                      items={itemsOf(o.id).map((i) => ({
                        productId: i.productId!,
                        slug: productOf.get(i.productId!)?.slug ?? "",
                        variantId: i.variantId,
                        stems: i.stems,
                        color: i.color,
                        quantity: i.quantity,
                        name: pick(locale, i.productName, productOf.get(i.productId!)?.nameRu),
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
        <h2 id="addr-h" className="mb-4 text-3xl">
          {t.addresses}
        </h2>
        {addresses.length === 0 ? (
          <p className="text-muted">{t.noAddresses}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="card p-5 text-sm">
                <p className="font-semibold">
                  {a.recipientName}, {formatPhone(a.recipientPhone)}
                </p>
                <p className="mt-1 text-muted">{[a.district, a.neighborhood, a.address, a.apartment].filter(Boolean).join(", ")}</p>
                <form action={deleteAddressAction.bind(null, a.id)} className="mt-3">
                  <button className="text-danger hover:underline">{t.remove}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-12 text-sm">
        <Link href={lp("/sevimlilar")} className="text-forest underline">
          {t.favoritesLink}
        </Link>
      </p>
    </div>
  );
}
