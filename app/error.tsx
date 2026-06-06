"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 bg-zinc-950">
      <div className="text-center space-y-4 max-w-sm">
        <p className="font-mono text-xs text-amber-500 uppercase tracking-widest">Something broke</p>
        <p className="text-zinc-400 text-sm">
          The interviewer choked on something unexpected. That&apos;s on us.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border border-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm font-medium hover:border-zinc-500 transition-colors"
          >
            Start over
          </Link>
        </div>
      </div>
    </main>
  );
}
