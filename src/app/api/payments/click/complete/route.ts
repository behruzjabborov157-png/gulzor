import { clickRequest } from "@/lib/payments/click";

export const dynamic = "force-dynamic";

/** Click SHOP API "Complete" URL. */
export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text());
  return Response.json(await clickRequest(form, 1));
}
