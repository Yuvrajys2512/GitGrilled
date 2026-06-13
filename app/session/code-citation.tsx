"use client";

import { useEffect, useState } from "react";
import { FileCode2, ChevronRight } from "lucide-react";
import { highlightLine } from "@/lib/highlight";

const CONTEXT = 4; // lines of context around the cited range

// Module-level cache so the same file isn't refetched across citations/messages.
const fileCache = new Map<string, Promise<string | null>>();

function fetchFile(repo: string, branch: string, path: string): Promise<string | null> {
  const key = `${repo}@${branch}:${path}`;
  let p = fileCache.get(key);
  if (!p) {
    p = fetch(
      `/api/file?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { content: string } | null) => d?.content ?? null)
      .catch(() => null);
    fileCache.set(key, p);
  }
  return p;
}

interface Props {
  repo: string; // "owner/name"
  branch: string;
  path: string;
  line: number;
  endLine: number | null;
  label: string;
  // Start expanded and eagerly load the snippet (used by the bug-hunt card so
  // the challenge code is on screen immediately).
  defaultOpen?: boolean;
}

export function CodeCitation({ repo, branch, path, line, endLine, label, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [lines, setLines] = useState<string[]>([]);

  async function load() {
    if (state !== "idle") return;
    setState("loading");
    const content = await fetchFile(repo, branch, path);
    if (content === null) {
      setState("error");
    } else {
      setLines(content.split("\n"));
      setState("loaded");
    }
  }

  // Eagerly load when rendered already-open (bug-hunt card). The fetch runs in
  // an async callback — not synchronously in the effect body — and bails if the
  // component unmounts mid-flight.
  useEffect(() => {
    if (!defaultOpen) return;
    let active = true;
    (async () => {
      const content = await fetchFile(repo, branch, path);
      if (!active) return;
      if (content === null) {
        setState("error");
      } else {
        setLines(content.split("\n"));
        setState("loaded");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  const hi = line;
  const lo = endLine ? Math.min(line, endLine) : line;
  const top = endLine ? Math.max(line, endLine) : line;
  const from = Math.max(1, lo - CONTEXT);
  const to = top + CONTEXT;

  return (
    <span className="inline-block align-baseline">
      <button
        onClick={toggle}
        className="inline-flex items-center gap-1 font-mono text-[0.8em] text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded px-1.5 py-0.5 hover:bg-amber-900/40 hover:border-amber-700 transition-colors align-baseline"
        title={open ? "Hide code" : "Show code"}
      >
        <FileCode2 className="w-3 h-3 shrink-0" />
        {label}
        <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <span className="block my-2 rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden text-left not-italic">
          <span className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60">
            <span className="font-mono text-[11px] text-zinc-400">{path}</span>
            <span className="font-mono text-[10px] text-zinc-600">
              {endLine ? `lines ${lo}–${top}` : `line ${hi}`}
            </span>
          </span>

          {state === "loading" && (
            <span className="block px-3 py-3 font-mono text-xs text-zinc-600">Loading…</span>
          )}
          {state === "error" && (
            <span className="block px-3 py-3 font-mono text-xs text-red-400/80">
              Couldn&apos;t load {path} — the file may have moved.
            </span>
          )}
          {state === "loaded" && (
            <span className="block overflow-x-auto py-1.5 text-xs leading-relaxed">
              {lines.slice(from - 1, to).map((ln, i) => {
                const num = from + i;
                const highlighted = endLine ? num >= lo && num <= top : num === hi;
                return (
                  <span
                    key={num}
                    className={`flex ${highlighted ? "bg-amber-500/10 border-l-2 border-amber-500" : "border-l-2 border-transparent"}`}
                  >
                    <span className="select-none text-right pr-3 pl-3 w-12 shrink-0 text-zinc-700 font-mono">
                      {num}
                    </span>
                    <code className="font-mono whitespace-pre text-zinc-300 pr-4">
                      {highlightLine(ln)}
                    </code>
                  </span>
                );
              })}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
