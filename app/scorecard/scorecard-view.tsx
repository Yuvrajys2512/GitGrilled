"use client";

import Link from "next/link";
import type { Scorecard } from "@/lib/scorecard";
import { verdictLabel } from "@/lib/scorecard";

function scoreText(score: number): string {
  return score >= 7 ? "text-green-400" : score >= 5 ? "text-yellow-400" : "text-red-400";
}
function scoreBar(score: number): string {
  return score >= 7 ? "bg-green-500" : score >= 5 ? "bg-yellow-500" : "bg-red-500";
}

export function ScorecardView({ card }: { card: Scorecard | null }) {
  if (!card || !card.owner) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-4 bg-zinc-950">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-zinc-400 text-sm font-mono">This scorecard link is invalid or expired.</p>
          <Link href="/" className="inline-block text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors">
            ← Grill your own repo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center min-h-screen px-4 bg-zinc-950 py-12">
      <div className="w-full max-w-2xl space-y-8">

        {/* Brand */}
        <div className="flex items-center justify-between">
          <Link href="/" className="font-mono text-sm text-amber-500 hover:text-amber-400 transition-colors">
            🔥 GitGrilled
          </Link>
          <span className="font-mono text-xs text-zinc-600">interview scorecard</span>
        </div>

        {/* Hero */}
        <div className="flex items-end justify-between gap-4 border-b border-zinc-900 pb-8">
          <div className="space-y-2">
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">{card.owner}/{card.repo}</p>
            <h1 className={`text-3xl font-bold ${scoreText(card.score)}`}>{verdictLabel(card.score)}</h1>
          </div>
          <div className={`font-mono font-bold ${scoreText(card.score)}`}>
            <span className="text-6xl">{card.score}</span>
            <span className="text-zinc-600 text-2xl">/10</span>
          </div>
        </div>

        {/* Verdict */}
        {card.verdict && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-300 text-sm leading-relaxed">{card.verdict}</p>
          </div>
        )}

        {/* Categories */}
        {card.categories.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">By category</h2>
            <div className="space-y-3">
              {card.categories.map((c, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{c.name}</span>
                    <span className="text-zinc-500 font-mono text-xs">{c.score}/10</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${scoreBar(c.score)}`} style={{ width: `${(c.score / 10) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40 flex items-center justify-between gap-4">
          <div>
            <p className="text-zinc-300 text-sm font-medium">Think you&apos;d do better?</p>
            <p className="text-zinc-600 text-xs mt-0.5">Drop in a GitHub repo and get grilled.</p>
          </div>
          <Link
            href="/"
            className="bg-white text-black px-4 py-2 rounded text-sm font-semibold shrink-0 hover:bg-zinc-200 transition-colors"
          >
            Grill me →
          </Link>
        </div>

      </div>
    </main>
  );
}
