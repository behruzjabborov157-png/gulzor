import type { Metadata } from "next";
import Link from "next/link";
import { fmt, localePath } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { alternates } from "@/i18n/seo";
import { getLocale } from "@/i18n/server";
import { getCustomer } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import { getSettings, telegramLink } from "@/lib/settings";
import { DeleteAccountForm } from "./delete-form";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDict(locale).meta.deleteAccount, alternates: alternates(locale, "/hisobni-ochirish") };
}

/**
 * Public account-deletion page. Google Play asks for a web link where users can delete their
 * account (also without the app), so it explains the steps to everyone and shows the form to
 * signed-in customers.
 */
export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ ochirildi?: string }> }) {
  const locale = await getLocale();
  const t = getDict(locale).account.deleteAccount;
  const lp = (p: string) => localePath(locale, p);
  const [customer, { store }, { ochirildi }] = await Promise.all([getCustomer(), getSettings(), searchParams]);
  const tg = telegramLink(store.telegramUsername);

  if (ochirildi && !customer) {
    return (
      <div className="container-page max-w-2xl pt-12">
        <h1 className="text-4xl">{t.deletedTitle}</h1>
        <p className="mt-4 text-muted">{t.deletedText}</p>
        <Link href={lp("/")} className="btn-primary mt-8">
          {t.home}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page max-w-2xl space-y-8 pt-12">
      <div>
        <h1 className="text-4xl">{t.title}</h1>
        <p className="mt-3 text-muted">{t.intro}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-5" aria-labelledby="del-now">
          <h2 id="del-now" className="text-xl">{t.whatDeleted}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            {t.deletedList.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className="card p-5" aria-labelledby="del-kept">
          <h2 id="del-kept" className="text-xl">{t.whatKept}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            {t.keptList.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      </div>

      {customer ? (
        <DeleteAccountForm signedInAs={fmt(t.signedInAs, { name: customer.name, phone: formatPhone(customer.phone) })} />
      ) : (
        <section aria-labelledby="del-steps">
          <h2 id="del-steps" className="text-2xl">{t.stepsTitle}</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            {t.steps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          <Link href={`${lp("/hisob")}?next=${encodeURIComponent(lp("/hisobni-ochirish"))}`} className="btn-primary mt-6">
            {t.signIn}
          </Link>
        </section>
      )}

      <p className="text-sm text-muted">
        {t.noAccess}{" "}
        {store.phone || tg ? (
          <>
            {store.phone ? (
              <a href={`tel:${store.phone}`} className="text-wine underline">
                {formatPhone(store.phone)}
              </a>
            ) : null}
            {store.phone && tg ? " · " : null}
            {tg ? (
              <a href={tg} target="_blank" rel="noopener noreferrer" className="text-wine underline">
                Telegram
              </a>
            ) : null}
          </>
        ) : (
          t.contactSoon
        )}
      </p>
    </div>
  );
}
