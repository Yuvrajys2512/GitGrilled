"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function parseGithubUrl(raw: string): { owner: string; repo: string } | null {
  const cleaned = raw.trim().replace(/\.git$/, "");

  // matches: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const patterns = [
    /^(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)\/?$/,
    /^([^/]+)\/([^/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const [, owner, repo] = match;
      if (owner && repo) return { owner, repo };
    }
  }
  return null;
}

export function RepoInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!value.trim()) {
      setError("Paste a GitHub repo URL to get started.");
      return;
    }

    const parsed = parseGithubUrl(value);
    if (!parsed) {
      setError("Couldn't parse that. Try: https://github.com/owner/repo");
      return;
    }

    router.push(`/session?repo=${parsed.owner}/${parsed.repo}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-3">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="https://github.com/owner/repo"
          className="font-mono text-sm bg-zinc-900 border-zinc-700 placeholder:text-zinc-600 focus-visible:ring-zinc-500 h-11"
          autoFocus
          spellCheck={false}
        />
        <Button
          type="submit"
          className="h-11 px-5 bg-white text-black hover:bg-zinc-200 font-semibold shrink-0"
        >
          Grill Me
        </Button>
      </div>
      {error && (
        <p className="text-red-400 text-sm font-mono">{error}</p>
      )}
    </form>
  );
}
