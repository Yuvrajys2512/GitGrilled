import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Generated, per-session pages — no value indexed, and /session/scorecard
      // are driven entirely by query params.
      disallow: ["/api/", "/session", "/scorecard"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
