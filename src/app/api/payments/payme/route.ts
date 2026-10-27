import { paymeRpc } from "@/lib/payments/payme";

export const dynamic = "force-dynamic";

/** Payme Merchant API endpoint. Configure this URL in the Payme merchant cabinet. */
export async function POST(req: Request) {
  const body = await req.text();
  const result = await paymeRpc(req.headers.get("authorization"), body);
  return Response.json(result);
}
