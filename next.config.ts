import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: { "/*": ["./assets/fonts/*.ttf"] },
  outputFileTracingExcludes: {
    "/*": ["./.data/**/*", "./work/**/*", "./.env*"],
  },
  allowedDevOrigins: ["127.0.0.1"],
};
export default config;
