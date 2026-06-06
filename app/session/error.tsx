"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[session]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <p className="font-mono text-xs text-amber-500 uppercase tracking-widest">Session error</p>
        <p className="text-zinc-400 text-sm">
          This interview hit a snag. Restart it or try a different repo.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="bg-white text-black px-4 py-2 rounded text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Restart
          </button>
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
          >
            ← New repo
          </Link>
        </div>
      </div>
    </div>
  );
}
