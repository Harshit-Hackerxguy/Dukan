import { randomUUID } from "node:crypto";
import { whatsappConfiguration, isProduction } from "../config";
import type { Delivery, Order } from "../domain";
import type { UnitOfWork } from "../repositories/interfaces";
import { AppError } from "../errors";

export type SendResult = Pick<
  Delivery,
  "status" | "messageId" | "error" | "retryable"
>;
export interface WhatsAppProvider {
  send(order: Order, recipient: string, attemptId: string): Promise<SendResult>;
}
export class MockWhatsAppProvider implements WhatsAppProvider {
  async send(): Promise<SendResult> {
    if (isProduction())
      return {
        status: "not_configured",
        error: "Development messaging is disabled in production.",
      };
    return {
      status: "mock",
      error: "Mock send recorded. No WhatsApp message was sent.",
    };
  }
}

export class CloudWhatsAppProvider implements WhatsAppProvider {
  constructor(private transport: typeof fetch = fetch) {}
  async send(
    order: Order,
    recipient: string,
    attemptId: string,
  ): Promise<SendResult> {
    const c = whatsappConfiguration();
    if (!c.configured)
      return {
        status: "not_configured",
        error:
          "Configure the sender ID, API access token, and approved document template.",
      };
    const base = `https://graph.facebook.com/${c.version}/${c.sender}`;
    const headers = { Authorization: `Bearer ${c.token}` };
    let mediaId: string;
    try {
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", "application/pdf");
      form.append(
        "file",
        new Blob([new Uint8Array(Buffer.from(order.pdfBase64, "base64"))], {
          type: "application/pdf",
        }),
        `${order.memoNumber}.pdf`,
      );
      const response = await this.transport(`${base}/media`, {
        method: "POST",
        headers,
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        return {
          status: "failed",
          error: `PDF upload rejected (HTTP ${response.status}). Check the provider configuration.`,
          retryable: response.status === 429 || response.status >= 500,
        };
      const data = (await response.json()) as { id?: string };
      if (!data.id) throw new Error("Missing media ID");
      mediaId = data.id;
    } catch {
      return {
        status: "failed",
        error:
          "PDF upload could not be completed. No message send was attempted.",
        retryable: true,
      };
    }
    // Always use an approved utility template with a DOCUMENT header. This does
    // not assume an open 24-hour customer service window for the store recipient.
    try {
      const response = await this.transport(`${base}/messages`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient.replace(/^\+/, ""),
          type: "template",
          biz_opaque_callback_data: `${order.id}:${attemptId}`,
          template: {
            name: c.template,
            language: { code: c.language },
            components: [
              {
                type: "header",
                parameters: [
                  {
                    type: "document",
                    document: {
                      id: mediaId,
                      filename: `${order.memoNumber}.pdf`,
                    },
                  },
                ],
              },
              {
                type: "body",
                parameters: [
                  order.memoNumber,
                  order.customer.name,
                  order.customer.phone,
                  `₹${(order.totalPaise / 100).toLocaleString("en-IN")}`,
                ].map((text) => ({ type: "text", text })),
              },
            ],
          },
        }),
      });
      if (response.status >= 500)
        return {
          status: "unknown",
          error:
            "The provider response is uncertain. Check WhatsApp delivery before sharing manually; automatic resend is blocked.",
        };
      if (!response.ok)
        return {
          status: "failed",
          error: `WhatsApp rejected the send (HTTP ${response.status}). Check template approval, permissions, and recipient eligibility.`,
          retryable: response.status === 429,
        };
      const data = (await response.json()) as { messages?: { id: string }[] };
      if (!data.messages?.[0]?.id)
        return {
          status: "unknown",
          error:
            "No message receipt was returned. Automatic resend is blocked to prevent duplicates.",
        };
      return { status: "accepted", messageId: data.messages[0].id };
    } catch {
      return {
        status: "unknown",
        error:
          "The send timed out or lost its connection. Delivery is unknown; automatic resend is blocked.",
      };
    }
  }
}

export class WhatsAppService {
  constructor(
    private uow: UnitOfWork,
    private provider?: WhatsAppProvider,
  ) {}
  async dispatch(id: string, retry = false): Promise<Delivery> {
    const claim = await this.uow.transaction((r) => {
      const order = r.orders.get(id);
      if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
      const d = order.whatsapp;
      if (
        d.status === "sending" &&
        Date.now() - Date.parse(d.updatedAt) > 120000
      ) {
        order.whatsapp = {
          ...d,
          status: "unknown",
          error:
            "The previous send was interrupted. Confirm delivery before manual sharing.",
          updatedAt: new Date().toISOString(),
        };
        r.orders.save(order);
      }
      const state = order.whatsapp;
      if (!["pending", "failed", "not_configured"].includes(state.status))
        return { delivery: state };
      if (state.status !== "pending" && !retry) return { delivery: state };
      if (state.attempts >= 3)
        throw new AppError(
          409,
          "RETRY_LIMIT",
          "The retry limit has been reached. Use manual PDF sharing after checking delivery.",
        );
      if (state.nextAttemptAt && Date.parse(state.nextAttemptAt) > Date.now())
        throw new AppError(
          429,
          "RETRY_LATER",
          "Please wait before retrying this message.",
        );
      const settings = r.settings.get();
      const c = whatsappConfiguration();
      const mock = c.mode === "mock" && !isProduction();
      if (
        !this.provider &&
        !mock &&
        (c.mode !== "cloud" ||
          !c.configured ||
          !settings.whatsappRecipient ||
          !settings.whatsappConsentAt)
      ) {
        order.whatsapp = {
          ...state,
          status: "not_configured",
          error:
            "Automatic WhatsApp sending is not configured. Use manual PDF sharing.",
          updatedAt: new Date().toISOString(),
        };
        r.orders.save(order);
        return { delivery: order.whatsapp };
      }
      const attemptId = randomUUID();
      order.whatsapp = {
        status: "sending",
        attempts: state.attempts + 1,
        attemptId,
        recipient: settings.whatsappRecipient,
        updatedAt: new Date().toISOString(),
      };
      r.orders.save(order);
      return { order, recipient: settings.whatsappRecipient, attemptId };
    });
    if (claim.delivery) return claim.delivery;
    const provider =
      this.provider ||
      (whatsappConfiguration().mode === "mock"
        ? new MockWhatsAppProvider()
        : new CloudWhatsAppProvider());
    let result: SendResult;
    try {
      result = await provider.send(
        claim.order!,
        claim.recipient!,
        claim.attemptId!,
      );
    } catch {
      result = {
        status: "unknown",
        error:
          "The send outcome is unknown. Check delivery before manual sharing.",
      };
    }
    return this.uow.transaction((r) => {
      const order = r.orders.get(id)!;
      // A signed webhook can arrive before the send response. Preserve its state.
      if (
        order.whatsapp.attemptId === claim.attemptId &&
        order.whatsapp.status === "sending"
      ) {
        order.whatsapp = {
          ...order.whatsapp,
          ...result,
          updatedAt: new Date().toISOString(),
          nextAttemptAt:
            result.status === "failed"
              ? new Date(
                  Date.now() + 30000 * 2 ** (order.whatsapp.attempts - 1),
                ).toISOString()
              : undefined,
        };
        r.orders.save(order);
      }
      return order.whatsapp;
    });
  }
  async webhook(
    event: {
      id: string;
      status: string;
      timestamp: string;
      recipient_id?: string;
      biz_opaque_callback_data?: string;
      errors?: { code?: number }[];
    },
    sender: string,
  ) {
    const allowed = ["sent", "delivered", "read", "failed"];
    if (
      !allowed.includes(event.status) ||
      sender !== whatsappConfiguration().sender
    )
      return;
    const time = Number(event.timestamp);
    if (!Number.isFinite(time)) return;
    await this.uow.transaction((r) => {
      const order = r.orders
        .list()
        .find(
          (o) =>
            o.whatsapp.messageId === event.id ||
            `${o.id}:${o.whatsapp.attemptId}` ===
              event.biz_opaque_callback_data,
        );
      if (
        !order ||
        !event.recipient_id ||
        order.whatsapp.recipient?.replace(/^\+/, "") !== event.recipient_id
      )
        return;
      const d = order.whatsapp;
      if (d.eventAt && time < d.eventAt) return;
      const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
      if (
        (rank[d.status] || 0) >= 2 &&
        (rank[event.status] || 0) < (rank[d.status] || 0)
      )
        return;
      if (
        (rank[event.status] || 0) < (rank[d.status] || 0) &&
        event.status !== "failed"
      )
        return;
      const code = event.errors?.[0]?.code;
      order.whatsapp = {
        ...d,
        status: event.status as Delivery["status"],
        messageId: event.id,
        eventAt: time,
        updatedAt: new Date().toISOString(),
        error:
          event.status === "failed"
            ? `WhatsApp reported delivery failure${typeof code === "number" ? ` (${code})` : ""}.`
            : undefined,
        retryable:
          event.status === "failed" &&
          [130429, 131000, 131016].includes(code || 0),
      };
      r.orders.save(order);
    });
  }
}
