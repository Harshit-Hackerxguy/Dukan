import { createHmac, timingSafeEqual } from "node:crypto";
import { DeliveryStatus, Prisma } from "@prisma/client";
import { transaction } from "./db";
import { HttpError } from "./http";
class ProviderError extends Error {
  constructor(
    message: string,
    public ambiguous: boolean,
    public retryable = false,
    public response: Prisma.InputJsonValue = {},
  ) {
    super(message);
  }
}
async function sendDocument(
  pdf: Uint8Array,
  number: string,
  recipient: string,
  attemptId: string,
) {
  const {
    WHATSAPP_TOKEN: token,
    WHATSAPP_PHONE_NUMBER_ID: phoneId,
    WHATSAPP_TEMPLATE: template,
    WHATSAPP_API_VERSION: version,
  } = process.env;
  if (!token || !phoneId || !template || !version)
    throw new ProviderError("WhatsApp provider is not configured", false);
  const base = `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneId)}`;
  const headers = { Authorization: `Bearer ${token}` };
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", "application/pdf");
  form.set(
    "file",
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    `${number}.pdf`,
  );
  let media: Response;
  try {
    media = await fetch(`${base}/media`, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new ProviderError("PDF upload failed", false, true);
  }
  if (!media.ok)
    throw new ProviderError(
      `PDF upload rejected (${media.status})`,
      false,
      media.status === 429 || media.status >= 500,
      { httpStatus: media.status },
    );
  const uploaded = (await media.json()) as { id?: string };
  if (!uploaded.id)
    throw new ProviderError("No uploaded media ID returned", false);
  let response: Response;
  try {
    response = await fetch(`${base}/messages`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient.replace("+", ""),
        type: "template",
        biz_opaque_callback_data: attemptId,
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: { id: uploaded.id, filename: `${number}.pdf` },
                },
              ],
            },
          ],
        },
      }),
    });
  } catch {
    throw new ProviderError(
      "Provider result unknown; check WhatsApp before retrying",
      true,
    );
  }
  if (!response.ok)
    throw new ProviderError(
      `Message rejected (${response.status})`,
      response.status >= 500,
      response.status === 429,
      { httpStatus: response.status },
    );
  let result: { messages?: { id: string }[] };
  try {
    result = await response.json();
  } catch {
    throw new ProviderError("Provider result could not be read", true);
  }
  if (!result.messages?.[0]?.id)
    throw new ProviderError("Provider did not return a message ID", true);
  return result.messages[0].id;
}
export async function processNextJob(sender = sendDocument) {
  // A process might die after the provider accepts a message. Never blindly resend stale jobs.
  await transaction(async (tx) => {
    const stale = await tx.outboxJob.findMany({
      where: {
        status: "RUNNING",
        lockedAt: { lt: new Date(Date.now() - 5 * 60000) },
      },
      take: 100,
    });
    for (const job of stale) {
      await tx.outboxJob.update({
        where: { id: job.id },
        data: {
          status: "UNCERTAIN",
          lastError:
            "Worker stopped during delivery; check provider before retry",
        },
      });
      await tx.whatsAppDeliveryAttempt.updateMany({
        where: { memoId: job.memoId, status: "PENDING" },
        data: { status: "UNCERTAIN" },
      });
      await tx.cashMemo.update({
        where: { id: job.memoId },
        data: { deliveryStatus: "UNCERTAIN" },
      });
    }
  });
  const claimed = await transaction(async (tx) => {
    const jobs = await tx.$queryRaw<
      { id: string; memoId: string }[]
    >`SELECT id, "memoId" FROM "OutboxJob" WHERE status = 'PENDING' AND "nextAttemptAt" <= NOW() ORDER BY "nextAttemptAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!jobs[0]) return null;
    const job = await tx.outboxJob.update({
      where: { id: jobs[0].id },
      data: {
        status: "RUNNING",
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    const memo = await tx.cashMemo.findUniqueOrThrow({
      where: { id: job.memoId },
    });
    const attempt = await tx.whatsAppDeliveryAttempt.create({
      data: { memoId: memo.id, recipientPhone: memo.recipientPhone },
    });
    return { job, memo, attempt };
  });
  if (!claimed) return false;
  const { job, memo, attempt } = claimed;
  try {
    const providerMessageId = await sender(
      memo.pdf,
      memo.number,
      memo.recipientPhone,
      attempt.id,
    );
    await transaction(async (tx) => {
      // A signed webhook can arrive before this response. Preserve its newer status.
      const current = await tx.whatsAppDeliveryAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      const status =
        current.status === "PENDING" || current.status === "UNCERTAIN"
          ? "SUBMITTED"
          : current.status;
      await tx.whatsAppDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status,
          providerMessageId,
          providerResponse: { messageId: providerMessageId },
        },
      });
      await tx.cashMemo.update({
        where: { id: memo.id },
        data: { deliveryStatus: status },
      });
      await tx.outboxJob.update({
        where: { id: job.id },
        data: {
          status: status === "FAILED" ? "FAILED" : "DONE",
          lockedAt: null,
          lastError: null,
        },
      });
    });
  } catch (error) {
    const e =
      error instanceof ProviderError
        ? error
        : new ProviderError(
            "Delivery result unknown; check provider before retry",
            true,
          );
    await transaction(async (tx) => {
      const current = await tx.whatsAppDeliveryAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      if (["SUBMITTED", "SENT", "DELIVERED"].includes(current.status)) return;
      const status = e.ambiguous ? "UNCERTAIN" : "FAILED";
      const retry = !e.ambiguous && e.retryable && job.attempts < 5;
      await tx.whatsAppDeliveryAttempt.update({
        where: { id: attempt.id },
        data: { status, error: e.message, providerResponse: e.response },
      });
      await tx.cashMemo.update({
        where: { id: memo.id },
        data: { deliveryStatus: status },
      });
      await tx.outboxJob.update({
        where: { id: job.id },
        data: {
          status: e.ambiguous ? "UNCERTAIN" : retry ? "PENDING" : "FAILED",
          lockedAt: null,
          lastError: e.message,
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000,
          ),
        },
      });
    });
  }
  return true;
}
export async function retryDelivery(
  memoId: string,
  adminId: string,
  acknowledgeUncertain: boolean,
) {
  return transaction(async (tx) => {
    const job = await tx.outboxJob.findUniqueOrThrow({ where: { memoId } });
    if (!["FAILED", "UNCERTAIN"].includes(job.status))
      throw new HttpError(
        409,
        "Delivery is already queued or accepted by the provider",
      );
    if (job.status === "UNCERTAIN" && !acknowledgeUncertain)
      throw new HttpError(
        409,
        "Check WhatsApp and acknowledge that retrying an uncertain delivery may send a duplicate PDF",
      );
    await tx.outboxJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      },
    });
    await tx.cashMemo.update({
      where: { id: memoId },
      data: { deliveryStatus: "PENDING" },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: "WHATSAPP_RETRY",
        entityId: memoId,
        details: { acknowledgeUncertain },
      },
    });
  });
}
export function verifyWebhook(raw: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) throw new HttpError(503, "Webhook is not configured");
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (
    !signature ||
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw new HttpError(401, "Invalid webhook signature");
}
export async function applyWebhook(payload: unknown) {
  const data = payload as {
    entry?: {
      changes?: {
        value?: {
          statuses?: {
            id: string;
            status: string;
            biz_opaque_callback_data?: string;
            errors?: { code: number; title: string }[];
          }[];
        };
      }[];
    }[];
  };
  for (const entry of data.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const event of change.value?.statuses ?? []) {
        const status = (
          {
            sent: "SENT",
            delivered: "DELIVERED",
            read: "DELIVERED",
            failed: "FAILED",
          } as Record<string, DeliveryStatus>
        )[event.status];
        if (!status || typeof event.id !== "string") continue;
        await transaction(async (tx) => {
          const attempt = await tx.whatsAppDeliveryAttempt.findFirst({
            where: {
              OR: [
                { providerMessageId: event.id },
                ...(event.biz_opaque_callback_data
                  ? [{ id: event.biz_opaque_callback_data }]
                  : []),
              ],
            },
          });
          if (
            !attempt ||
            (attempt.providerMessageId &&
              attempt.providerMessageId !== event.id)
          )
            return;
          if (
            attempt.status === "DELIVERED" ||
            (attempt.status === "SENT" &&
              status !== "DELIVERED" &&
              status !== "FAILED") ||
            (attempt.status === "FAILED" && status === "SENT")
          )
            return;
          await tx.whatsAppDeliveryAttempt.update({
            where: { id: attempt.id },
            data: {
              status,
              providerMessageId: event.id,
              providerResponse: {
                status: event.status,
                errors: (event.errors ?? []).map((e) => ({
                  code: e.code,
                  title: e.title,
                })),
              },
            },
          });
          const latest = await tx.whatsAppDeliveryAttempt.findFirst({
            where: { memoId: attempt.memoId },
            orderBy: { createdAt: "desc" },
          });
          if (latest?.id === attempt.id) {
            await tx.cashMemo.update({
              where: { id: attempt.memoId },
              data: { deliveryStatus: status },
            });
            await tx.outboxJob.update({
              where: { memoId: attempt.memoId },
              data: {
                status: status === "FAILED" ? "FAILED" : "DONE",
                lockedAt: null,
              },
            });
          }
        });
      }
}
