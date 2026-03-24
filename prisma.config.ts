import path from "node:path"
import { config } from "dotenv"
import { defineConfig } from "prisma/config"

const root = __dirname

// Next.js genelde .env.local kullanır; Prisma CLI sadece .env okursa DATABASE_URL boş kalır
config({ path: path.join(root, ".env") })
config({ path: path.join(root, ".env.local"), override: true })

const databaseUrl = process.env.DATABASE_URL ?? ""
// Supabase: migrate/db push için pooler değil doğrudan oturum bağlantısı önerilir (serial hatalarını önler)
const directUrl =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? databaseUrl

export default defineConfig({
  schema: path.join(root, "prisma/schema.prisma"),
  datasource: {
    url: databaseUrl,
    ...(directUrl ? { directUrl } : {}),
  },
})

