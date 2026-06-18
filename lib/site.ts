// Single source of truth for the canonical site origin, used by metadata,
// robots, sitemap, OG image URLs, and share links.
//
// Prefer an explicit NEXT_PUBLIC_SITE_URL (set this once a custom domain
// exists). On Vercel, fall back to the project's production URL, then the
// per-deployment URL. Locally, fall back to localhost. Always returns an
// origin with no trailing slash.
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
