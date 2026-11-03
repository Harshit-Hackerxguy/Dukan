import { ZodError } from "zod";
import { cookies } from "next/headers";
import { AppError } from "./errors";
import { auth } from "./container";
import { SESSION_COOKIE } from "./services/admin-auth-service";

export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError)
      return json({ error: e.message, code: e.code }, e.status);
    if (e instanceof ZodError)
      return json(
        {
          error: "Please check the form fields and quantities.",
          code: "INVALID_INPUT",
          fields: e.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        400,
      );
    // Never expose provider payloads, stack traces, customer data, or credentials.
    console.error(
      "Request failed",
      e instanceof Error ? e.name : "UnknownError",
    );
    return json(
      {
        error: "The request could not be completed. Please try again.",
        code: "INTERNAL_ERROR",
      },
      500,
    );
  }
}
export function sameOrigin(request: Request) {
  // Next may normalize request.url to localhost behind its dev server. The
  // browser Origin must match the actual incoming Host, never Forwarded headers.
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const origin = process.env.SITE_ORIGIN || `${url.protocol}//${host}`;
  if (
    request.headers.get("origin") !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError(
      403,
      "INVALID_ORIGIN",
      "Please submit this request from the store website.",
    );
}
export async function readText(request: Request, max = 800000) {
  if (Number(request.headers.get("content-length")) > max)
    throw new AppError(413, "BODY_TOO_LARGE", "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError(400, "INVALID_BODY", "A request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, "BODY_TOO_LARGE", "The request is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function body(request: Request) {
  sameOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError(415, "JSON_REQUIRED", "Use a JSON request.");
  try {
    return JSON.parse(await readText(request));
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, "INVALID_JSON", "The request could not be read.");
  }
}
export const requireAdmin = async () =>
  auth.authenticate((await cookies()).get(SESSION_COOKIE)?.value);
export function clientKey(request: Request) {
  // Only enable behind a trusted reverse proxy that overwrites this header.
  return process.env.TRUST_PROXY_IP === "true"
    ? request.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        .trim()
        .slice(0, 80) || "shared"
    : "shared";
}
