import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  // Permit the loopback hostname used by local browser tests and development.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingExcludes: {
    "/*": ["./.data/**/*", "./work/**/*", "./.env*"],
  },
  outputFileTracingIncludes: { "/api/**/*": ["./public/fonts/*.ttf"] },
  allowedDevOrigins: ["127.0.0.1"],
};

export default config;
