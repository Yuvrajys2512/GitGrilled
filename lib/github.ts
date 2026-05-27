import type { RepoContext, RepoFile } from "./types";

const GITHUB_API = "https://api.github.com";
const RAW_BASE = "https://raw.githubusercontent.com";

const MAX_FILES = 35;
const MAX_FILE_CHARS = 5_000;

const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__",
  ".cache", "vendor", "coverage", ".nyc_output", "out", ".turbo",
  ".vercel", "storybook-static", ".expo", ".gradle", "target",
]);

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".tiff", ".avif",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp4", ".mp3", ".wav", ".ogg", ".avi", ".mov", ".webm",
  ".zip", ".tar", ".gz", ".rar", ".7z", ".br", ".zst",
  ".pdf", ".docx", ".xlsx", ".pptx",
  ".exe", ".dll", ".so", ".dylib", ".class", ".jar",
  ".pyc", ".pyo", ".pyd",
  ".db", ".sqlite", ".sqlite3",
  ".bin", ".wasm",
]);

const LOCK_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  "poetry.lock", "Gemfile.lock", "composer.lock", "go.sum", "Cargo.lock",
]);

// Lower number = higher priority
const PRIORITY_MAP: Record<string, number> = {
  "readme.md": 0, "readme.txt": 0, "readme": 0,
  "package.json": 1, "pyproject.toml": 1, "go.mod": 1,
  "cargo.toml": 1, "requirements.txt": 1, "gemfile": 1,
  "tsconfig.json": 2, "jsconfig.json": 2,
  "next.config.ts": 3, "next.config.js": 3, "next.config.mjs": 3,
  "vite.config.ts": 3, "vite.config.js": 3,
  "dockerfile": 4, "docker-compose.yml": 4, "docker-compose.yaml": 4,
  ".env.example": 4, ".env.sample": 4,
  "main.ts": 5, "main.tsx": 5, "main.js": 5, "main.py": 5,
  "index.ts": 5, "index.tsx": 5, "index.js": 5,
  "app.ts": 5, "app.tsx": 5, "app.py": 5,
  "server.ts": 5, "server.js": 5,
};

const SOURCE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".rb", ".java", ".php", ".cs", ".cpp", ".c", ".swift", ".kt",
]);

const CONFIG_EXTS = new Set([".json", ".yaml", ".yml", ".toml", ".env"]);
const MARKUP_EXTS = new Set([".md", ".mdx"]);

function getFilePriority(path: string): number {
  const filename = path.split("/").pop()!.toLowerCase();
  if (PRIORITY_MAP[filename] !== undefined) return PRIORITY_MAP[filename];

  const ext = filename.includes(".") ? ("." + filename.split(".").pop()!) as string : "";
  const depth = path.split("/").length;

  if (SOURCE_EXTS.has(ext)) return 10 + depth;
  if (CONFIG_EXTS.has(ext)) return 20 + depth;
  if (MARKUP_EXTS.has(ext)) return 30 + depth;
  return 50 + depth;
}

function isExcluded(path: string): boolean {
  const parts = path.split("/");
  for (const part of parts.slice(0, -1)) {
    if (EXCLUDED_DIRS.has(part) || part.startsWith(".")) return true;
  }
  const filename = parts[parts.length - 1];
  if (LOCK_FILES.has(filename)) return true;
  if (filename.startsWith(".") && !filename.startsWith(".env")) return true;
  const ext = filename.includes(".") ? ("." + filename.split(".").pop()!.toLowerCase()) : "";
  return BINARY_EXTS.has(ext);
}

function buildFileTree(paths: string[]): string {
  type TreeNode = { [key: string]: TreeNode | null };
  const root: TreeNode = {};

  for (const path of paths) {
    const parts = path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] ??= {};
      node = node[parts[i]] as TreeNode;
    }
    node[parts[parts.length - 1]] = null;
  }

  function render(node: TreeNode, prefix = ""): string {
    return Object.entries(node)
      .map(([key, val]) =>
        val === null
          ? `${prefix}${key}`
          : `${prefix}${key}/\n${render(val, prefix + "  ")}`
      )
      .join("\n");
  }

  return render(root);
}

function authHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return token
    ? { Authorization: `Bearer ${token}`, "User-Agent": "gitgrilled/1.0" }
    : { "User-Agent": "gitgrilled/1.0" };
}

async function ghFetch(url: string) {
  const res = await fetch(url, {
    headers: authHeaders(),
    next: { revalidate: 300 },
  });
  if (res.status === 404) throw new Error("REPO_NOT_FOUND");
  if (res.status === 403 || res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return res.json();
}

async function fetchFileContent(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<RepoFile | null> {
  try {
    const url = `${RAW_BASE}/${owner}/${repo}/${branch}/${path}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const raw = await res.text();
    // Skip files that look binary despite extension check
    if (raw.includes("\x00")) return null;
    const truncated = raw.length > MAX_FILE_CHARS;
    return {
      path,
      content: truncated ? raw.slice(0, MAX_FILE_CHARS) + "\n... [truncated]" : raw,
      truncated,
    };
  } catch {
    return null;
  }
}

async function fetchBatch(
  owner: string,
  repo: string,
  branch: string,
  paths: string[]
): Promise<(RepoFile | null)[]> {
  return Promise.all(paths.map((p) => fetchFileContent(owner, repo, branch, p)));
}

const MANIFEST_NAMES = new Set([
  "package.json", "pyproject.toml", "go.mod", "cargo.toml",
  "requirements.txt", "gemfile",
]);

const README_NAMES = new Set(["readme.md", "readme.txt", "readme"]);

export async function buildRepoContext(
  owner: string,
  repo: string
): Promise<RepoContext> {
  const meta = await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}`);
  const defaultBranch: string = meta.default_branch;
  const treeData = await ghFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`
  );

  const allBlobs: { path: string }[] = (treeData.tree as { type: string; path: string }[])
    .filter((item) => item.type === "blob")
    .map((item) => ({ path: item.path }));

  const eligible = allBlobs
    .filter((f) => !isExcluded(f.path))
    .sort((a, b) => getFilePriority(a.path) - getFilePriority(b.path))
    .slice(0, MAX_FILES);

  // Fetch in parallel batches of 10
  const BATCH = 10;
  const fetched: RepoFile[] = [];
  for (let i = 0; i < eligible.length; i += BATCH) {
    const batch = eligible.slice(i, i + BATCH).map((f) => f.path);
    const results = await fetchBatch(owner, repo, defaultBranch, batch);
    fetched.push(...results.filter((r): r is RepoFile => r !== null));
  }

  let readme: string | null = null;
  let manifest: { path: string; content: string } | null = null;
  const files: RepoFile[] = [];

  for (const file of fetched) {
    const filename = file.path.split("/").pop()!.toLowerCase();
    if (README_NAMES.has(filename) && !readme) {
      readme = file.content;
    } else if (MANIFEST_NAMES.has(filename) && !manifest) {
      manifest = { path: file.path, content: file.content };
      files.push(file);
    } else {
      files.push(file);
    }
  }

  const treeDisplay = buildFileTree(eligible.slice(0, 150).map((f) => f.path));

  return {
    owner,
    repo,
    description: meta.description ?? null,
    defaultBranch,
    language: meta.language ?? null,
    stars: meta.stargazers_count ?? 0,
    readme,
    manifest,
    files,
    fileTree: treeDisplay,
    totalFiles: allBlobs.length,
    includedFiles: files.length,
  };
}
