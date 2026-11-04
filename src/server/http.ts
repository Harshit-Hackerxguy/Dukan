import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json({ error: e.issues.map((i) => i.message).join(". ") }, 400);
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034", "P2003", "P2025"].includes(e.code)
    )
      return json(
        {
          error:
            "The record changed or conflicts with existing data. Refresh and try again.",
        },
        409,
      );
    console.error(
      "Request failed",
      e instanceof Error ? e.name : "UnknownError",
    );
    return json(
      { error: "The service is temporarily unavailable. Please try again." },
      503,
    );
  }
}
export function sameOrigin(req: Request) {
  const expected = process.env.APP_ORIGIN;
  if (!expected)
    throw new HttpError(503, "Application origin is not configured");
  if (req.headers.get("origin") !== new URL(expected).origin)
    throw new HttpError(403, "Request origin is not allowed");
}
export async function readBody(req: Request, maxBytes = 800000) {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function body(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "JSON required");
  const text = await readBody(req);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  seconds: number,
) {
  const now = Date.now();
  const key = hash(
    `${scope}:${identifier}:${Math.floor(now / (seconds * 1000))}`,
  );
  const entry = await db.rateLimit.upsert({
    where: { key },
    create: { key, expiresAt: new Date(now + seconds * 2000) },
    update: { count: { increment: 1 } },
  });
  if (entry.count > limit)
    throw new HttpError(429, "Too many attempts. Please try again later.");
}
export function clientKey(req: Request) {
  // Only enable after the reverse proxy strips client-supplied forwarding headers.
  return process.env.TRUST_PROXY === "true"
    ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "global"
    : "global";
}
