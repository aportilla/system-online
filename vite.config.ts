import { defineConfig } from 'vite'

// The one Node global this config needs, declared rather than pulled in:
// @types/node isn't in the tree, and one env var doesn't earn it.
declare const process: { env: Record<string, string | undefined> }

/** Normalize a base path to Vite's `/prefix/` shape; `/` for a site at a root. */
function normalizeBase(raw: string): string {
  const trimmed = raw.replace(/^\/+|\/+$/g, '')
  return trimmed === '' ? '/' : `/${trimmed}/`
}

// A GitHub Pages *project* site is served under /<repo>/, and every URL the
// build emits has to carry that prefix. The workflow passes the real one in
// S7_BASE (a custom domain or a user site would send `/`); the default is what
// `npm run build` uses locally. `||`, not `??`: a step output that didn't
// resolve arrives as an empty string, and taking that literally would build a
// root-based site whose every asset 404s under /system7web/.
//
// The Character Set window builds strike URLs at runtime from
// `import.meta.env.BASE_URL`, so the base reaches the fonts too — they sit in
// public/ and are copied verbatim rather than bundled, which is what keeps
// them a browsable collection instead of 87 hashed assets nobody asked for.
export default defineConfig({
  base: normalizeBase(process.env.S7_BASE || '/system7web/'),
})
