import { readFileSync } from "node:fs"

/* minimal .env loader for scripts (drizzle-kit, seed) that run outside Next.js */
export function loadEnvFile(files: string[] = [".env.local", ".env"]) {
  for (const file of files) {
    try {
      const content = readFileSync(file, "utf8")
      for (const line of content.split("\n")) {
        const match = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)?\s*$/)
        const name = match?.[1]
        if (name && process.env[name] === undefined) {
          process.env[name] = (match?.[2] ?? "").replace(/^["']|["']$/g, "")
        }
      }
    } catch {
      // file missing, skip
    }
  }
}
