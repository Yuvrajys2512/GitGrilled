"use client";

import { Fragment } from "react";
import { parseMessage } from "@/lib/citations";
import { CodeCitation } from "./code-citation";

interface Props {
  text: string;
  owner: string;
  repo: string;
  branch: string;
  // Render every code citation already expanded (used by the bug-hunt card).
  autoExpand?: boolean;
}

// Renders an interviewer message, turning every "path:line" reference into a
// clickable, expandable code snippet pulled from the real repo.
export function MessageContent({ text, owner, repo, branch, autoExpand = false }: Props) {
  const tokens = parseMessage(text);
  const repoSlug = `${owner}/${repo}`;

  return (
    <span className="whitespace-pre-wrap">
      {tokens.map((tok, i) =>
        tok.type === "text" ? (
          <Fragment key={i}>{tok.value}</Fragment>
        ) : (
          <CodeCitation
            key={i}
            repo={repoSlug}
            branch={branch}
            path={tok.path}
            line={tok.line}
            endLine={tok.endLine}
            label={tok.raw}
            defaultOpen={autoExpand}
          />
        )
      )}
    </span>
  );
}
