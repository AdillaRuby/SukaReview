/**
 * Zero-dependency on purpose: lib/google/sync.ts (where this used to live)
 * transitively imports lib/supabase/admin.ts, which has `import "server-only"`
 * — that throws unconditionally when required outside Next's bundler
 * aliasing. scripts/resolve-places.ts imports this function via plain
 * `tsx`, so it must not pull in that chain.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/suka shawarma/i, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `outlet-${Date.now()}`;
}
