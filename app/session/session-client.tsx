"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { projectProfileSchema, type ProjectProfile } from "@/lib/profile";
import type { RepoContext, AnalyzeError } from "@/lib/types";
import { PERSONAS, DEFAULT_PERSONA, type PersonaId } from "@/lib/personas";
import { InterviewChat } from "./interview-chat";

// ─── Loading spinner ────────────────────────────────────────────────
function Dots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

// ─── Phase 2 loading ────────────────────────────────────────────────
const ANALYZE_MSGS = [
  "Connecting to GitHub...",
  "Fetching file tree...",
  "Reading source files...",
  "Mapping project structure...",
];

function AnalyzingView({ owner, repo }: { owner: string; repo: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => Math.min(i + 1, ANALYZE_MSGS.length - 1)), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4">
        <Dots />
        <div>
          <p className="text-white font-mono text-sm">{owner}/{repo}</p>
          <p className="text-zinc-500 text-xs mt-1 font-mono">{ANALYZE_MSGS[idx]}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 3 loading ────────────────────────────────────────────────
const PROFILE_MSGS = [
  "Reading your code...",
  "Spotting the naive implementations...",
  "Finding your weak spots...",
  "Building the interview brief...",
  "Sharpening the questions...",
];

function ProfilingView({ owner, repo }: { owner: string; repo: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => Math.min(i + 1, PROFILE_MSGS.length - 1)), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4">
        <Dots />
        <div>
          <p className="text-white font-mono text-sm">{owner}/{repo}</p>
          <p className="text-zinc-500 text-xs mt-1 font-mono">{PROFILE_MSGS[idx]}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Error view ─────────────────────────────────────────────────────
function ErrorView({ error, owner, repo }: { error: AnalyzeError; owner: string; repo: string }) {
  const msgs: Record<string, string> = {
    REPO_NOT_FOUND: `Couldn't find ${owner}/${repo}. Make sure it's a public repo.`,
    RATE_LIMITED: "Rate limit hit. Try again in a few minutes.",
    INVALID_REPO: "Invalid repository format.",
    PROFILE_ERROR: "The AI couldn't analyze this repo (it may be too large). Try again, or try a different repo.",
    FETCH_ERROR: "Something went wrong fetching the repo.",
  };
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-red-400 font-mono text-sm">{msgs[error.code] ?? msgs.FETCH_ERROR}</p>
        <Link href="/" className="inline-block text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors">
          ← Try a different repo
        </Link>
      </div>
    </div>
  );
}

// ─── Difficulty badge ────────────────────────────────────────────────
function DiffBadge({ d }: { d: "medium" | "hard" | "brutal" }) {
  const styles = {
    medium: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
    hard: "bg-orange-900/40 text-orange-400 border-orange-800",
    brutal: "bg-red-900/40 text-red-400 border-red-800",
  };
  return (
    <span className={`text-[10px] font-mono border px-1.5 py-0.5 rounded uppercase tracking-wider ${styles[d]}`}>
      {d}
    </span>
  );
}

// ─── Profile view ────────────────────────────────────────────────────
function ProfileView({
  profile,
  owner,
  repo,
  isReady,
  persona,
  onPersonaChange,
  onStart,
}: {
  profile: ProjectProfile;
  owner: string;
  repo: string;
  isReady: boolean;
  persona: PersonaId;
  onPersonaChange: (id: PersonaId) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col max-w-3xl mx-auto w-full py-8 gap-6">

      {/* Header */}
      <div>
        <h2 className="text-white text-xl font-semibold">{owner}/{repo}</h2>
        {profile.summary && (
          <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{profile.summary}</p>
        )}
      </div>

      {/* Stack */}
      {profile.stack && (
        <section className="space-y-2">
          <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Stack</h3>
          <div className="flex flex-wrap gap-2">
            {[
              profile.stack.language,
              profile.stack.framework,
              ...(profile.stack.keyLibraries ?? []),
              ...(profile.stack.databases ?? []),
              ...(profile.stack.infrastructure ?? []),
            ]
              .filter(Boolean)
              .map((item) => (
                <span key={item} className="text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
                  {item}
                </span>
              ))}
          </div>
        </section>
      )}

      {/* Architecture */}
      {profile.architecture && (
        <section className="space-y-2">
          <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Architecture</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded">
                {profile.architecture.pattern}
              </span>
            </div>
            {profile.architecture.description && (
              <p className="text-zinc-300 text-sm leading-relaxed">{profile.architecture.description}</p>
            )}
            {profile.architecture.keyModules?.length > 0 && (
              <div className="grid gap-1.5 pt-1">
                {profile.architecture.keyModules.map((mod) => (
                  <div key={mod.name} className="flex gap-2 text-sm">
                    <code className="text-amber-400 font-mono text-xs shrink-0 pt-0.5">{mod.name}</code>
                    <span className="text-zinc-400 text-xs">{mod.purpose}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Notable decisions */}
      {profile.notableDecisions?.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Notable decisions</h3>
          <div className="space-y-2">
            {profile.notableDecisions.map((d, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1">
                <p className="text-zinc-200 text-sm">{d.decision}</p>
                <p className="text-zinc-500 text-xs">{d.implication}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Weak spots */}
      {profile.weakSpots?.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Weak spots</h3>
          <div className="space-y-1.5">
            {profile.weakSpots.map((w, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-red-500 shrink-0">✗</span>
                <span className="text-zinc-400 text-xs">{w}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Probe areas */}
      {profile.probeAreas?.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Probe areas</h3>
          <div className="space-y-2">
            {profile.probeAreas.map((area, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white text-sm font-medium">{area.topic}</span>
                  <DiffBadge d={area.difficulty} />
                </div>
                <p className="text-zinc-500 text-xs">{area.angle}</p>
                <p className="text-zinc-300 text-xs italic border-l-2 border-zinc-700 pl-2">
                  &ldquo;{area.sampleQuestion}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Persona picker */}
      <section className="space-y-2">
        <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Pick your interviewer</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {PERSONAS.map((p) => {
            const selected = p.id === persona;
            return (
              <button
                key={p.id}
                onClick={() => onPersonaChange(p.id)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  selected
                    ? "border-amber-600 bg-amber-950/30"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{p.emoji}</span>
                  <span className={`text-sm font-medium ${selected ? "text-amber-300" : "text-zinc-200"}`}>
                    {p.name}
                  </span>
                </div>
                <p className="text-zinc-500 text-xs mt-1 leading-snug">{p.tagline}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 flex items-center justify-between">
        <div>
          <p className="text-zinc-400 text-sm font-medium">Ready to get grilled?</p>
          <p className="text-zinc-600 text-xs mt-0.5">
            {isReady
              ? `${profile.probeAreas?.length ?? 0} probe areas loaded`
              : "Generating interview brief..."}
          </p>
        </div>
        <button
          onClick={onStart}
          disabled={!isReady}
          className="bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Start Interview →
        </button>
      </div>

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────
type Phase = "analyzing" | "profiling" | "ready" | "interviewing" | "error";

export function SessionClient({ owner, repo }: { owner: string; repo: string }) {
  const [phase, setPhase] = useState<Phase>("analyzing");
  const [context, setContext] = useState<RepoContext | null>(null);
  const [profile, setProfile] = useState<ProjectProfile | null>(null);
  const [analyzeError, setAnalyzeError] = useState<AnalyzeError | null>(null);
  const [persona, setPersona] = useState<PersonaId>(DEFAULT_PERSONA);
  const profileStarted = useRef(false);

  // Phase 2: fetch repo context
  useEffect(() => {
    fetch(`/api/analyze?repo=${owner}/${repo}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setAnalyzeError(data as AnalyzeError);
          setPhase("error");
        } else {
          setContext(data as RepoContext);
          setPhase("profiling");
        }
      })
      .catch(() => {
        setAnalyzeError({ code: "FETCH_ERROR", message: "Network error" });
        setPhase("error");
      });
  }, [owner, repo]);

  // Phase 3: generate profile once context is ready
  useEffect(() => {
    if (phase !== "profiling" || !context || profileStarted.current) return;
    profileStarted.current = true;

    (async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(context),
        });
        if (!res.ok) {
          setAnalyzeError(
            res.status === 429 ? { code: "RATE_LIMITED" } : { code: "PROFILE_ERROR" }
          );
          setPhase("error");
          return;
        }
        // The route returns a schema-validated ProjectProfile as plain JSON.
        const parsed = projectProfileSchema.safeParse(await res.json());
        if (parsed.success) {
          setProfile(parsed.data);
          setPhase("ready");
        } else {
          setAnalyzeError({ code: "FETCH_ERROR", message: "Profile parse failed" });
          setPhase("error");
        }
      } catch {
        setAnalyzeError({ code: "PROFILE_ERROR" });
        setPhase("error");
      }
    })();
  }, [phase, context]);

  const showHeader = phase !== "interviewing";

  return (
    <>
      {showHeader && (
        <header className="flex items-center justify-between py-4 border-b border-zinc-900 max-w-3xl mx-auto w-full px-4 shrink-0">
          <Link href="/" className="font-mono text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            ← GitGrilled
          </Link>
          <span className="font-mono text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
            {owner}/{repo}
          </span>
        </header>
      )}

      <div className="flex flex-1 flex-col px-4 min-h-0">
        {phase === "analyzing" && <AnalyzingView owner={owner} repo={repo} />}
        {phase === "profiling" && <ProfilingView owner={owner} repo={repo} />}

        {phase === "error" && (
          <ErrorView
            error={analyzeError ?? { code: "FETCH_ERROR", message: "AI analysis failed" }}
            owner={owner}
            repo={repo}
          />
        )}

        {phase === "ready" && profile && (
          <ProfileView
            profile={profile}
            owner={owner}
            repo={repo}
            isReady={true}
            persona={persona}
            onPersonaChange={setPersona}
            onStart={() => setPhase("interviewing")}
          />
        )}

        {phase === "interviewing" && profile && context && (
          <InterviewChat
            profile={profile}
            owner={owner}
            repo={repo}
            branch={context.defaultBranch}
            fileTree={context.fileTree}
            persona={persona}
          />
        )}
      </div>
    </>
  );
}
