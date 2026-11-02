import type { NextConfig } from "next";

const config: NextConfig = {
  // Permit the loopback hostname used by local browser tests and development.
  allowedDevOrigins: ["127.0.0.1"],
};

export default config;
