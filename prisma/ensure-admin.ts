import { config } from "dotenv"
import { resolve } from "path"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { existsSync } from "fs"

const envLocalPath = resolve(process.cwd(), ".env.local")
const envPath = resolve(process.cwd(), ".env")
config({ path: existsSync(envLocalPath) ? envLocalPath : envPath })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.")
}

const cleanConnectionString = connectionString.startsWith("prisma+postgres://")
  ? connectionString.replace("prisma+postgres://", "postgresql://")
  : connectionString

const pool = new Pool({
  connectionString: cleanConnectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
})

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: ["error", "warn"],
})

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`${name} is not set.`)
  return v
}

async function main() {
  await prisma.$connect()

  const email = requiredEnv("ADMIN_EMAIL")
  const password = requiredEnv("ADMIN_PASSWORD")
  const isim = (process.env.ADMIN_FIRST_NAME ?? "Admin").trim() || "Admin"
  const soyisim = (process.env.ADMIN_LAST_NAME ?? "User").trim() || "User"
  const departman = (process.env.ADMIN_DEPARTMENT ?? "Admin").trim() || "Admin"

  const pwdHash = await bcrypt.hash(password, 10)

  await prisma.customDepartment.upsert({
    where: { name: departman },
    update: {},
    create: { name: departman },
  })

  const calisan = await prisma.calisan.upsert({
    where: { email },
    update: {
      isim,
      soyisim,
      departman,
      password: pwdHash,
      istenCikisTarihi: null,
    },
    create: {
      isim,
      soyisim,
      email,
      departman,
      password: pwdHash,
      istenCikisTarihi: null,
    },
    select: { id: true, email: true, departman: true },
  })

  console.log("Admin user ensured:")
  console.log(`- id: ${calisan.id}`)
  console.log(`- email: ${calisan.email}`)
  console.log(`- departman: ${calisan.departman}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

