import { notFound } from "next/navigation";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ repo?: string }>;
}

function parseRepo(repo: string): { owner: string; name: string } | null {
  const parts = repo.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  return { owner: parts[0], name: parts[1] };
}

export default async function SessionPage({ searchParams }: Props) {
  const { repo } = await searchParams;

  if (!repo) notFound();

  const parsed = parseRepo(repo);
  if (!parsed) notFound();

  return (
    <main className="flex flex-col min-h-screen bg-zinc-950 px-4">
      <header className="flex items-center justify-between py-4 border-b border-zinc-900 max-w-4xl mx-auto w-full">
        <Link href="/" className="font-mono text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← GitGrilled
        </Link>
        <span className="font-mono text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
          {parsed.owner}/{parsed.name}
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center max-w-4xl mx-auto w-full">
        <div className="text-center space-y-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mx-auto" />
          <p className="text-zinc-400 font-mono text-sm">
            Interview session for{" "}
            <span className="text-white">{parsed.owner}/{parsed.name}</span>
          </p>
          <p className="text-zinc-600 text-xs">
            Analysis and interview coming in Phase 2 & 3
          </p>
        </div>
      </div>
    </main>
  );
}
