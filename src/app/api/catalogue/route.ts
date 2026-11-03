import { products } from "@/server/container";
import { handle, json } from "@/server/http";
export const runtime = "nodejs";
export async function GET() {
  return handle(async () => json(await products.catalogue()));
}
