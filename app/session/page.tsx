import { notFound } from "next/navigation";
import { SessionClient } from "./session-client";

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
    <main className="flex flex-col min-h-screen bg-zinc-950">
      <SessionClient owner={parsed.owner} repo={parsed.name} />
    </main>
  );
}
