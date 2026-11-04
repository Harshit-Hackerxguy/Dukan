import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
// The optional WASM CLI engine avoids native downloads in restricted development
// environments. Production uses Prisma's stable native migration engine by default.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  ...(process.env.PRISMA_CLI_JS === "true"
    ? {
        experimental: { adapter: true },
        engine: "js" as const,
        adapter: async () =>
          new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      }
    : {
        engine: "classic" as const,
        datasource: {
          url: process.env.DATABASE_URL || "postgresql://localhost/dukan",
        },
      }),
});
