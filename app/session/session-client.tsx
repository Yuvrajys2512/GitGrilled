"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RepoContext, AnalyzeError } from "@/lib/types";

const LOADING_MESSAGES = [
  "Connecting to GitHub...",
  "Fetching file tree...",
  "Reading source files...",
  "Mapping project structure...",
  "Building context...",
];

function LoadingView({ owner, repo }: { owner: string; repo: string }) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <div>
          <p className="text-white font-mono text-sm">{owner}/{repo}</p>
          <p className="text-zinc-500 text-xs mt-1 font-mono transition-all">
            {LOADING_MESSAGES[msgIdx]}
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorView({ error, owner, repo }: { error: AnalyzeError; owner: string; repo: string }) {
  const messages: Record<string, string> = {
    REPO_NOT_FOUND: `Couldn't find ${owner}/${repo}. Make sure it's a public repo.`,
    RATE_LIMITED: "GitHub API rate limit hit. Try again in a few minutes.",
    INVALID_REPO: "Invalid repository format.",
    FETCH_ERROR: "Something went wrong fetching the repo.",
  };

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-red-400 font-mono text-sm">{messages[error.code] ?? messages.FETCH_ERROR}</p>
        <Link
          href="/"
          className="inline-block text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
        >
          ← Try a different repo
        </Link>
      </div>
    </div>
  );
}

function ContextView({ ctx }: { ctx: RepoContext }) {
  const [showTree, setShowTree] = useState(false);
  const treeLines = ctx.fileTree.split("\n").slice(0, 60);
  const treeStr = treeLines.join("\n") + (ctx.fileTree.split("\n").length > 60 ? "\n..." : "");

  return (
    <div className="flex flex-1 flex-col max-w-3xl mx-auto w-full py-8 gap-6">

      <div className="space-y-1">
        <h2 className="text-white text-xl font-semibold">{ctx.owner}/{ctx.repo}</h2>
        {ctx.description && (
          <p className="text-zinc-400 text-sm">{ctx.description}</p>
        )}
        <div className="flex items-center gap-3 pt-1">
          {ctx.language && (
            <span className="text-xs font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
              {ctx.language}
            </span>
          )}
          <span className="text-xs text-zinc-600">★ {ctx.stars.toLocaleString()}</span>
          <span className="text-xs text-zinc-600">
            {ctx.includedFiles} / {ctx.totalFiles} files analyzed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total files", value: ctx.totalFiles },
          { label: "Analyzed", value: ctx.includedFiles },
          { label: "Has README", value: ctx.readme ? "Yes" : "No" },
          { label: "Manifest", value: ctx.manifest ? ctx.manifest.path.split("/").pop()! : "None" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1">
            <p className="text-zinc-500 text-xs font-mono">{label}</p>
            <p className="text-white text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowTree((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
        >
          <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">
            File tree
          </span>
          <span className="text-zinc-600 text-xs font-mono">{showTree ? "▲ hide" : "▼ show"}</span>
        </button>
        {showTree && (
          <pre className="px-4 pb-4 text-xs font-mono text-zinc-400 leading-5 overflow-x-auto">
            {treeStr}
          </pre>
        )}
      </div>

      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 text-center space-y-2">
        <p className="text-zinc-500 text-xs font-mono">
          Analysis complete — interview engine coming in Phase 3 & 4
        </p>
        <p className="text-zinc-600 text-xs">
          {ctx.files.length} source files ingested, ready for AI analysis
        </p>
      </div>

    </div>
  );
}

export function SessionClient({ owner, repo }: { owner: string; repo: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [context, setContext] = useState<RepoContext | null>(null);
  const [error, setError] = useState<AnalyzeError | null>(null);

  useEffect(() => {
    fetch(`/api/analyze?repo=${owner}/${repo}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data as AnalyzeError);
          setState("error");
        } else {
          setContext(data as RepoContext);
          setState("ready");
        }
      })
      .catch(() => {
        setError({ code: "FETCH_ERROR", message: "Network error" });
        setState("error");
      });
  }, [owner, repo]);

  return (
    <>
      <header className="flex items-center justify-between py-4 border-b border-zinc-900 max-w-3xl mx-auto w-full px-4">
        <Link
          href="/"
          className="font-mono text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← GitGrilled
        </Link>
        <span className="font-mono text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
          {owner}/{repo}
        </span>
      </header>

      <div className="flex flex-1 flex-col px-4">
        {state === "loading" && <LoadingView owner={owner} repo={repo} />}
        {state === "error" && error && <ErrorView error={error} owner={owner} repo={repo} />}
        {state === "ready" && context && <ContextView ctx={context} />}
      </div>
    </>
  );
}
