import { cookies } from "next/headers";
import { auth } from "@/server/container";
import { body, clientKey, handle, json, sameOrigin } from "@/server/http";
import {
  SESSION_COOKIE,
  SESSION_SECONDS,
} from "@/server/services/admin-auth-service";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  return handle(async () => {
    const { action } = await context.params;
    if (action === "request")
      return json(await auth.request(await body(request), clientKey(request)));
    if (action === "verify") {
      const token = await auth.verify(await body(request), clientKey(request));
      (await cookies()).set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_SECONDS,
      });
      return json({ authenticated: true });
    }
    if (action === "logout") {
      sameOrigin(request);
      const jar = await cookies();
      await auth.logout(jar.get(SESSION_COOKIE)?.value || "");
      jar.delete(SESSION_COOKIE);
      return json({ authenticated: false });
    }
    return json({ error: "Not found." }, 404);
  });
}
