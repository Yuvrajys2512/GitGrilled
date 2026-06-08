import type { Metadata } from "next";
import { verdictLabel, fallbackRoast } from "@/lib/scorecard";
import { loadScorecard } from "@/lib/load-scorecard";
import { ScorecardView } from "./scorecard-view";

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

type SearchParams = Promise<{ d?: string; id?: string; m?: string }>;

function ogImageUrl(id?: string, d?: string, roast?: boolean): string {
  const base = id
    ? `${siteUrl()}/api/og?id=${encodeURIComponent(id)}`
    : `${siteUrl()}/api/og?d=${encodeURIComponent(d ?? "")}`;
  return roast ? `${base}&m=roast` : base;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { d, id, m } = await searchParams;
  const card = await loadScorecard({ id, d });
  if (!card) return { title: "GitGrilled — Scorecard" };

  const roastMode = m === "roast";
  const roastLine = card.roast || fallbackRoast(card.owner, card.repo, card.score);
  const title = roastMode
    ? `${card.owner}/${card.repo} got roasted (${card.score}/10)`
    : `${card.owner}/${card.repo} — ${verdictLabel(card.score)} (${card.score}/10)`;
  const description = roastMode
    ? roastLine
    : card.verdict || "Got grilled on my own code by GitGrilled.";
  const ogImage = ogImageUrl(id, d, roastMode);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ScorecardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { d, id, m } = await searchParams;
  const card = await loadScorecard({ id, d });
  return <ScorecardView card={card} roastMode={m === "roast"} />;
}
