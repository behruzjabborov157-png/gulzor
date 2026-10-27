import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. Language routing: Uzbek pages keep clean URLs (/katalog) and are rewritten internally to
 *    /uz/katalog; Russian pages live under /ru/…; /uz/… redirects to the clean URL.
 *    The detected language is passed to the app as the x-locale request header.
 * 2. Per-request Content-Security-Policy with a nonce (Next.js applies it to its own scripts).
 *    style-src keeps 'unsafe-inline' because inline style *attributes* (next/image `fill`,
 *    chart bar heights) cannot carry a nonce; scripts stay strictly nonce-based.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  // /uz/... is never a public URL — send it to the clean Uzbek address.
  if (pathname === "/uz" || pathname.startsWith("/uz/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  const isRu = pathname === "/ru" || pathname.startsWith("/ru/");
  const locale = isRu ? "ru" : "uz";

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const https = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    https ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-locale", locale);
  requestHeaders.set("Content-Security-Policy", csp);

  let response: NextResponse;
  if (!isRu && !isAdmin) {
    // Serve the Uzbek page from /uz/... without changing the address bar.
    const url = request.nextUrl.clone();
    url.pathname = `/uz${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.headers.set("Content-Security-Policy", csp);
  if (https && !isDev) response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
}

export const config = {
  matcher: [
    // Pages only (prefetches included — the language rewrite must apply to them too).
    // Skips API callbacks, static files, optimised images, uploaded media and metadata files.
    "/((?!api|_next/static|_next/image|images|media|favicon.ico|robots.txt|sitemap.xml|product-import-template.csv).*)",
  ],
};
