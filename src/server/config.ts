// Keep existing Phase 2 provider deployments compatible while using the Phase 3
// names for new installations. Server-only credentials never enter catalogue DTOs.
export const appOrigin = () =>
  process.env.APP_ORIGIN || process.env.SITE_ORIGIN;
export const trustProxy = () =>
  process.env.TRUST_PROXY === "true" ||
  (!process.env.TRUST_PROXY && process.env.TRUST_PROXY_IP === "true");
export const whatsappToken = () =>
  process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
export const whatsappTemplate = () =>
  process.env.WHATSAPP_TEMPLATE || process.env.WHATSAPP_TEMPLATE_NAME;
export const webhookVerifyToken = () =>
  process.env.WHATSAPP_VERIFY_TOKEN ||
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
