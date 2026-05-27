export interface RepoFile {
  path: string;
  content: string;
  truncated: boolean;
}

export interface RepoContext {
  owner: string;
  repo: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  stars: number;
  readme: string | null;
  manifest: { path: string; content: string } | null;
  files: RepoFile[];
  fileTree: string;
  totalFiles: number;
  includedFiles: number;
}

export type AnalyzeError =
  | { code: "REPO_NOT_FOUND" }
  | { code: "RATE_LIMITED" }
  | { code: "INVALID_REPO" }
  | { code: "FETCH_ERROR"; message: string };
