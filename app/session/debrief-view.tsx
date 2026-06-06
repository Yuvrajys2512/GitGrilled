"use client";

import { useState } from "react";
import Link from "next/link";
import { Share2, Check } from "lucide-react";
import type { Debrief } from "@/lib/debrief";
import { encodeScorecard, scorecardFromDebrief } from "@/lib/scorecard";

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 7 ? "text-green-400" : score >= 5 ? "text-yellow-400" : "text-red-400";
  return (
    <div className={`text-5xl font-bold font-mono ${color}`}>
      {score}<span className="text-zinc-600 text-2xl">/10</span>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color =
    score >= 7 ? "bg-green-500" : score >= 5 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-400 w-4 text-right">{score}</span>
    </div>
  );
}

interface Props {
  debrief: Partial<Debrief>;
  isStreaming: boolean;
  owner: string;
  repo: string;
}

export function DebriefView({ debrief, isStreaming, owner, repo }: Props) {
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  async function handleShare() {
    const token = encodeScorecard(scorecardFromDebrief(owner, repo, debrief));
    const url = `${window.location.origin}/scorecard?d=${token}`;
    // Prefer the native share sheet on mobile; fall back to clipboard.
    if (navigator.share) {
      try {
        await navigator.share({
          title: `GitGrilled — ${owner}/${repo}`,
          text: `I scored ${debrief.overallScore}/10 getting grilled on ${owner}/${repo}.`,
          url,
        });
        return;
      } catch {
        // user dismissed the sheet — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div className="flex flex-1 flex-col max-w-3xl mx-auto w-full py-8 gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-white text-xl font-semibold">Interview Debrief</h2>
          <p className="text-zinc-500 text-xs font-mono">{owner}/{repo}</p>
        </div>
        {debrief.overallScore !== undefined && (
          <ScoreRing score={debrief.overallScore} />
        )}
      </div>

      {/* Streaming indicator */}
      {isStreaming && !debrief.verdict && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
          <span>Generating debrief...</span>
        </div>
      )}

      {/* Verdict */}
      {debrief.verdict && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-zinc-300 text-sm leading-relaxed">{debrief.verdict}</p>
        </div>
      )}

      {/* Category scores */}
      {debrief.categories && debrief.categories.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">By category</h3>
          <div className="space-y-3">
            {debrief.categories.map((cat, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-200 text-sm font-medium">{cat.category}</span>
                </div>
                <ScoreBar score={cat.score} />
                {cat.notes && <p className="text-zinc-500 text-xs">{cat.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Strong / Weak */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {debrief.strongAreas && debrief.strongAreas.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Strong</h3>
            <div className="space-y-1.5">
              {debrief.strongAreas.map((s, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-green-500 shrink-0 text-xs mt-0.5">✓</span>
                  <span className="text-zinc-300 text-xs">{s}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {debrief.weakAreas && debrief.weakAreas.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Weak</h3>
            <div className="space-y-1.5">
              {debrief.weakAreas.map((w, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-red-500 shrink-0 text-xs mt-0.5">✗</span>
                  <span className="text-zinc-400 text-xs">{w}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Fumbled questions */}
      {debrief.fumbledQuestions && debrief.fumbledQuestions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Where you slipped</h3>
          <div className="space-y-2">
            {debrief.fumbledQuestions.map((fq, i) => (
              <div key={i} className="bg-zinc-900 border border-red-900/40 rounded-lg p-3 space-y-1.5">
                <p className="text-zinc-200 text-xs italic border-l-2 border-red-800 pl-2">
                  &ldquo;{fq.question}&rdquo;
                </p>
                <p className="text-zinc-500 text-xs">{fq.whatWentWrong}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Study topics */}
      {debrief.studyTopics && debrief.studyTopics.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Study these</h3>
          <div className="flex flex-wrap gap-2">
            {debrief.studyTopics.map((topic) => (
              <span key={topic} className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
                {topic}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      {!isStreaming && debrief.verdict && (
        <div className="flex gap-3 pt-2">
          <Link
            href={`/session?repo=${owner}/${repo}`}
            className="bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="border border-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm font-medium hover:border-zinc-500 transition-colors"
          >
            New Repo
          </Link>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 border border-amber-800/60 text-amber-400 px-4 py-2 rounded text-sm font-medium hover:border-amber-600 hover:bg-amber-950/30 transition-colors ml-auto"
          >
            {shareState === "copied" ? (
              <>
                <Check className="w-3.5 h-3.5" /> Link copied
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" /> Share scorecard
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
