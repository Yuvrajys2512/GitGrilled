import type { Metadata } from "next";
import { decodeScorecard, verdictLabel } from "@/lib/scorecard";
import { ScorecardView } from "./scorecard-view";

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

type SearchParams = Promise<{ d?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { d } = await searchParams;
  const card = d ? decodeScorecard(d) : null;
  if (!card) return { title: "GitGrilled — Scorecard" };

  const title = `${card.owner}/${card.repo} — ${verdictLabel(card.score)} (${card.score}/10)`;
  const description = card.verdict || "Got grilled on my own code by GitGrilled.";
  const ogImage = `${siteUrl()}/api/og?d=${encodeURIComponent(d!)}`;

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
  const { d } = await searchParams;
  const card = d ? decodeScorecard(d) : null;
  return <ScorecardView card={card} />;
}
