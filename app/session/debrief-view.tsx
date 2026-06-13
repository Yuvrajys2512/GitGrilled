"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Share2, Check, Flame } from "lucide-react";
import type { Debrief } from "@/lib/debrief";
import { encodeScorecard, scorecardFromDebrief, fallbackRoast } from "@/lib/scorecard";

// Ease a number from 0 → target over `duration` ms using requestAnimationFrame.
// (setState lives in the rAF callback, not the effect body, so it's lint-clean.)
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Fades + slides its children in on mount, after an optional delay. Used to
// stagger the debrief sections so they appear to "fill in" one after another.
function Reveal({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-500 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {children}
    </div>
  );
}

// Literal class strings (no interpolation) so Tailwind doesn't purge them.
function scoreColor(score: number, kind: "text" | "bg") {
  if (score >= 7) return kind === "text" ? "text-green-400" : "bg-green-500";
  if (score >= 5) return kind === "text" ? "text-yellow-400" : "bg-yellow-500";
  return kind === "text" ? "text-red-400" : "bg-red-500";
}

function ScoreRing({ score }: { score: number }) {
  const animated = useCountUp(score);
  return (
    <div className={`text-5xl font-bold font-mono tabular-nums ${scoreColor(score, "text")}`}>
      {animated.toFixed(1)}<span className="text-zinc-600 text-2xl">/10</span>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  // Width animates from 0 → pct once mounted (flag flips inside rAF).
  const [grown, setGrown] = useState(false);
  const animated = useCountUp(score, 900);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-[900ms] ease-out ${scoreColor(score, "bg")}`}
          style={{ width: grown ? `${pct}%` : "0%" }}
        />
      </div>
      <span className="text-xs font-mono text-zinc-400 w-6 text-right tabular-nums">
        {animated.toFixed(1)}
      </span>
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
  const [roastState, setRoastState] = useState<"idle" | "copied">("idle");

  async function handleShare(mode: "scorecard" | "roast") {
    const card = scorecardFromDebrief(owner, repo, debrief);

    // Prefer a short /scorecard?id= link (stored in Upstash). Fall back to the
    // self-contained ?d= base64 token when storage isn't configured.
    let url = "";
    try {
      const res = await fetch("/api/scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      if (res.ok) {
        const { id } = await res.json();
        if (id) url = `${window.location.origin}/scorecard?id=${id}`;
      }
    } catch {
      // ignore — fall through to the long token
    }
    if (!url) {
      url = `${window.location.origin}/scorecard?d=${encodeScorecard(card)}`;
    }
    if (mode === "roast") url += "&m=roast";

    const setCopied = mode === "roast" ? setRoastState : setShareState;
    const shareText =
      mode === "roast"
        ? `🔥 ${card.roast || fallbackRoast(owner, repo, card.score)} (${debrief.overallScore}/10 on ${owner}/${repo})`
        : `I scored ${debrief.overallScore}/10 getting grilled on ${owner}/${repo}.`;

    // Prefer the native share sheet on mobile; fall back to clipboard.
    if (navigator.share) {
      try {
        await navigator.share({
          title: `GitGrilled — ${owner}/${repo}`,
          text: shareText,
          url,
        });
        return;
      } catch {
        // user dismissed the sheet — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
      setTimeout(() => setCopied("idle"), 2000);
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

      {/* Roast — the shareable burn */}
      {debrief.roast && (
        <Reveal>
          <div className="rounded-lg border border-amber-900/50 bg-gradient-to-br from-amber-950/30 to-red-950/20 p-4">
            <p className="text-amber-100 text-base font-semibold leading-snug">
              <Flame className="inline w-4 h-4 mb-0.5 text-amber-500" /> &ldquo;{debrief.roast}&rdquo;
            </p>
          </div>
        </Reveal>
      )}

      {/* Verdict */}
      {debrief.verdict && (
        <Reveal delay={120}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-300 text-sm leading-relaxed">{debrief.verdict}</p>
          </div>
        </Reveal>
      )}

      {/* Category scores */}
      {debrief.categories && debrief.categories.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">By category</h3>
          <div className="space-y-3">
            {debrief.categories.map((cat, i) => (
              <Reveal key={i} delay={240 + i * 90}>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-200 text-sm font-medium">{cat.category}</span>
                  </div>
                  <ScoreBar score={cat.score} />
                  {cat.notes && <p className="text-zinc-500 text-xs">{cat.notes}</p>}
                </div>
              </Reveal>
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
            onClick={() => handleShare("scorecard")}
            className="flex items-center gap-2 border border-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm font-medium hover:border-zinc-500 transition-colors ml-auto"
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
          <button
            onClick={() => handleShare("roast")}
            className="flex items-center gap-2 border border-amber-800/60 text-amber-400 px-4 py-2 rounded text-sm font-medium hover:border-amber-600 hover:bg-amber-950/30 transition-colors"
          >
            {roastState === "copied" ? (
              <>
                <Check className="w-3.5 h-3.5" /> Roast copied
              </>
            ) : (
              <>
                <Flame className="w-3.5 h-3.5" /> Share roast
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
