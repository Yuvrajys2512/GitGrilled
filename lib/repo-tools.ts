import { tool } from "ai";
import { z } from "zod";
import { fetchRawFile, listRepoPaths } from "./github";

// Caps to keep tool output (and token cost) bounded.
const MAX_READ_LINES = 400;
const MAX_LIST_FILES = 300;
const MAX_SEARCH_FILES = 50;
const MAX_SEARCH_MATCHES = 30;

// Only grep through files that are plausibly human-readable source/config.
const SEARCHABLE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".rb", ".java", ".php", ".cs", ".cpp", ".c", ".h",
  ".swift", ".kt", ".scala", ".sh", ".sql",
  ".json", ".yaml", ".yml", ".toml", ".env", ".md", ".mdx", ".txt",
]);

function isSearchable(path: string): boolean {
  const name = path.split("/").pop()!.toLowerCase();
  const ext = name.includes(".") ? "." + name.split(".").pop()! : "";
  return SEARCHABLE_EXTS.has(ext);
}

function withLineNumbers(content: string): { body: string; lineCount: number; truncated: boolean } {
  const lines = content.split("\n");
  const truncated = lines.length > MAX_READ_LINES;
  const shown = lines.slice(0, MAX_READ_LINES);
  const body = shown.map((l, i) => `${String(i + 1).padStart(4, " ")}│${l}`).join("\n");
  return { body, lineCount: lines.length, truncated };
}

/**
 * Build the live codebase tools the interviewer uses to read the candidate's
 * actual repo mid-interview. A per-request cache avoids re-fetching the tree or
 * the same file across multiple tool calls within one turn.
 */
export function createRepoTools(owner: string, repo: string, branch: string) {
  let pathsCache: string[] | null = null;
  const fileCache = new Map<string, string | null>();

  async function getPaths(): Promise<string[]> {
    if (pathsCache) return pathsCache;
    const { paths } = await listRepoPaths(owner, repo);
    pathsCache = paths;
    return paths;
  }

  async function getFile(path: string): Promise<string | null> {
    if (fileCache.has(path)) return fileCache.get(path) ?? null;
    const content = await fetchRawFile(owner, repo, branch, path);
    fileCache.set(path, content);
    return content;
  }

  const listFiles = tool({
    description:
      "List files in the candidate's repository. Optionally filter by a path prefix " +
      "(e.g. 'lib' or 'app/api'). Use this to discover what exists before reading.",
    inputSchema: z.object({
      prefix: z
        .string()
        .optional()
        .describe("Only return paths starting with this prefix. Omit for the whole repo."),
    }),
    execute: async ({ prefix }) => {
      let paths = await getPaths();
      if (prefix) {
        const p = prefix.replace(/^\/+|\/+$/g, "");
        paths = paths.filter((f) => f.startsWith(p));
      }
      return {
        total: paths.length,
        shown: Math.min(paths.length, MAX_LIST_FILES),
        files: paths.slice(0, MAX_LIST_FILES),
      };
    },
  });

  const readFile = tool({
    description:
      "Read the real source of a file from the candidate's repo, with line numbers. " +
      "Use the EXACT path from listFiles. Always read the actual code before asking " +
      "about it — never guess what it says.",
    inputSchema: z.object({
      path: z.string().describe("Exact repo-relative path, e.g. 'lib/github.ts'"),
    }),
    execute: async ({ path }) => {
      const clean = path.replace(/^\/+/, "");
      const content = await getFile(clean);
      if (content === null) {
        const base = clean.split("/").pop()!.toLowerCase();
        const paths = await getPaths();
        const didYouMean = paths
          .filter((p) => p.toLowerCase().includes(base))
          .slice(0, 5);
        return { error: `File not found: ${clean}`, didYouMean };
      }
      const { body, lineCount, truncated } = withLineNumbers(content);
      return {
        path: clean,
        lineCount,
        truncated,
        content: truncated
          ? `${body}\n     … [truncated at ${MAX_READ_LINES} lines of ${lineCount}]`
          : body,
      };
    },
  });

  const searchCode = tool({
    description:
      "Search the repo's source files for a literal substring (case-insensitive). " +
      "Returns matches as 'path:line: text'. Use to find where something is implemented " +
      "before grilling on it.",
    inputSchema: z.object({
      query: z.string().describe("Literal substring, e.g. 'fetchBatch' or 'MAX_FILE_CHARS'"),
    }),
    execute: async ({ query }) => {
      const q = query.toLowerCase();
      const targets = (await getPaths()).filter(isSearchable).slice(0, MAX_SEARCH_FILES);
      const loaded = await Promise.all(
        targets.map(async (p) => [p, await getFile(p)] as const)
      );

      const matches: string[] = [];
      for (const [p, content] of loaded) {
        if (!content) continue;
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            matches.push(`${p}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
            if (matches.length >= MAX_SEARCH_MATCHES) break;
          }
        }
        if (matches.length >= MAX_SEARCH_MATCHES) break;
      }

      return {
        query,
        matchCount: matches.length,
        filesScanned: targets.length,
        matches,
      };
    },
  });

  return { tools: { listFiles, readFile, searchCode }, getPaths };
}
