// Keep existing Phase 2 provider deployments compatible while using the Phase 3
// names for new installations. Server-only credentials never enter catalogue DTOs.
export const appOrigin = () =>
  process.env.APP_ORIGIN || process.env.SITE_ORIGIN;
export const trustProxy = () =>
  process.env.TRUST_PROXY === "true" ||
  (!process.env.TRUST_PROXY && process.env.TRUST_PROXY_IP === "true");
