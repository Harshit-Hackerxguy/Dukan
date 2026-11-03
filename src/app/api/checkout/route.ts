import { auth, checkout } from "@/server/container";
import { body, clientKey, handle, json } from "@/server/http";
import { checkoutSchema } from "@/server/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    const input = checkoutSchema.parse(await body(request));
    await auth.rateLimit(`checkout:${clientKey(request)}`, 60, 10 * 60 * 1000);
    await auth.rateLimit(`checkout-phone:${input.phone}`, 10, 10 * 60 * 1000);
    return json(
      await checkout.submit(
        input,
        request.headers.get("idempotency-key") || "",
      ),
      201,
    );
  });
}
