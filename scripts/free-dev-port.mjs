/**
 * Port 3000'de dinleyen süreci sonlandırır ve .next/dev/lock dosyasını siler.
 * İkinci bir `pnpm dev` çalıştırıldığında oluşan kilit hatasını giderir.
 */
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"

const PORT = 3000
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const lockPath = path.join(projectRoot, ".next", "dev", "lock")

function killPortWindows(port) {
  try {
    const out = execSync("netstat -ano", { encoding: "utf8" })
    const pids = new Set()
    for (const line of out.split("\n")) {
      if (!line.includes("LISTENING")) continue
      if (!line.includes(`:${port}`)) continue
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (/^\d+$/.test(pid)) pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "pipe" })
        console.log(`[free-dev-port] Port ${port} — süreç sonlandırıldı (PID ${pid}).`)
      } catch {
        /* yok say */
      }
    }
  } catch {
    /* netstat yok / hata */
  }
}

function killPortUnix(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9`, {
      shell: true,
      stdio: "pipe",
    })
    console.log(`[free-dev-port] Port ${port} temizlendi.`)
  } catch {
    /* dinleyen yok */
  }
}

if (os.platform() === "win32") {
  killPortWindows(PORT)
} else {
  killPortUnix(PORT)
}

try {
  fs.unlinkSync(lockPath)
  console.log("[free-dev-port] .next/dev/lock kaldırıldı.")
} catch (e) {
  if (e && e.code !== "ENOENT") {
    console.warn("[free-dev-port] lock:", e.message)
  }
}
