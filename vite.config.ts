import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Build constants (src/env.d.ts): package.json's version, HEAD's commit date
// for the About box ("Sep 27, 2026", formatted here so no runtime locale moves
// it; today without git), and each imported strike's woff2 size in bytes, a
// font's size in the Finder.
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')

function buildDate(): string {
  let ymd = ''
  try {
    ymd = execFileSync('git', ['log', '-1', '--format=%cs'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    // no git: today
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
  const t = new Date()
  return `${MONTHS[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}`
}

function fontBytes(): Record<string, number> {
  const dir = new URL('./public/fonts/imported/', import.meta.url)
  const out: Record<string, number> = {}
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.woff2')) out[name] = statSync(new URL(name, dir)).size
  }
  return out
}

// Served at the root of system-online.portill.io, so Vite's default base holds.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_DATE__: JSON.stringify(buildDate()),
    __FONT_BYTES__: JSON.stringify(fontBytes()),
  },
})
