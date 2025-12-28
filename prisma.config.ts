import path from "node:path"
import { config } from "dotenv"
import { defineConfig } from "prisma/config"

// Load .env file
config()

export default defineConfig({
  schema: path.join(__dirname, "prisma/schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
})

