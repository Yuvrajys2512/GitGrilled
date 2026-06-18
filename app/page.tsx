import Link from "next/link";
import { RepoInput } from "@/components/repo-input";
import { Badge } from "@/components/ui/badge";

const SAMPLE_QUESTIONS = [
  "Why did you choose this architecture?",
  "How would you scale this under 10x load?",
  "What's the worst bug hiding in this codebase?",
  "Walk me through your auth flow.",
  "What would you rewrite if you had 2 more weeks?",
];

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 bg-zinc-950">
      <div className="flex flex-col items-center gap-8 w-full max-w-2xl text-center">

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="font-mono text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
              AI-powered technical interview
            </span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">
            GitGrilled
          </h1>
          <p className="text-zinc-400 text-lg mt-3">
            Drop in a GitHub repo. Get interviewed on it.
          </p>
          <p className="text-zinc-600 text-sm max-w-sm mx-auto mt-1">
            The AI reads your entire codebase and asks the hard questions — no softballs, no hand-holding.
          </p>
        </div>

        <RepoInput />

        <div className="space-y-3 w-full">
          <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">
            Expect questions like
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SAMPLE_QUESTIONS.map((q) => (
              <Badge
                key={q}
                variant="outline"
                className="text-zinc-400 border-zinc-800 bg-zinc-900/50 text-xs font-normal py-1 px-3"
              >
                {q}
              </Badge>
            ))}
          </div>
        </div>

      </div>

      <footer className="mt-16 text-center text-xs text-zinc-600">
        <p>
          AI-generated — analysis and scores may be wrong.{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-400">
            Privacy &amp; disclaimer
          </Link>
        </p>
      </footer>
    </main>
  );
}
