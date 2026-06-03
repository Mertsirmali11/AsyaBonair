import { PrismaClient } from "@prisma/client"
import * as dotenv from "dotenv"
import { resolve } from "path"

dotenv.config({ path: resolve(process.cwd(), ".env.local") })

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(
    "ALTER TABLE audit_finding_responses ADD COLUMN IF NOT EXISTS reject_comment TEXT"
  )
  console.log("✅ reject_comment sütunu eklendi.")
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌", e.message)
  process.exit(1)
})
