import { z } from "zod";
import type { RepoContext } from "./types";

export const probeAreaSchema = z.object({
  topic: z.string().describe("The technical topic being probed"),
  angle: z.string().describe("Specific aspect or concern to investigate"),
  difficulty: z.enum(["medium", "hard", "brutal"]),
  sampleQuestion: z.string().describe("A real interview question the interviewer might ask"),
});

export const projectProfileSchema = z.object({
  stack: z.object({
    language: z.string(),
    framework: z.string().nullable(),
    keyLibraries: z.array(z.string()),
    databases: z.array(z.string()),
    infrastructure: z.array(z.string()),
  }),
  architecture: z.object({
    pattern: z.string().describe("e.g. monolith, serverless, MVC, event-driven"),
    description: z.string().describe("2-3 sentences on how the system is structured"),
    keyModules: z.array(
      z.object({
        name: z.string(),
        purpose: z.string(),
      })
    ),
  }),
  notableDecisions: z.array(
    z.object({
      decision: z.string(),
      implication: z.string().describe("Why this matters / what it reveals"),
    })
  ).describe("3-5 specific technical decisions made in this codebase"),
  weakSpots: z.array(z.string()).describe("Honest gaps, naive implementations, missing edge cases"),
  probeAreas: z.array(probeAreaSchema).describe("5-8 areas to grill the candidate on — must be specific to this repo"),
  summary: z.string().describe("Honest 2-3 sentence assessment of the project and developer skill level"),
});

export type ProjectProfile = z.infer<typeof projectProfileSchema>;

export const ANALYSIS_SYSTEM_PROMPT = `You are a senior software engineer preparing a technical interview brief.

Given a codebase, produce a ProjectProfile that will be used to grill the author in a real technical interview.
Your job is NOT to flatter them — it is to find exactly what a tough interviewer would probe.

Rules:
- Look at what the code actually does, not just what the README claims
- Identify naive implementations, missing error handling, questionable design choices, and knowledge gaps
- Probe areas must reference actual files, patterns, or decisions visible in the code — no generic questions
- weakSpots should be blunt: if something is half-finished, over-engineered, or wrong, say so
- Difficulty "brutal" means a question that would make most mid-level engineers sweat

The candidate wrote this code. They should be able to defend every line. Your profile prepares the interviewer to make sure they can.`;

// Budgets kept deliberately tight: the profiler only needs enough to identify
// the stack, architecture, and probe areas — the interviewer reads the full repo
// live via tools. A smaller prompt also keeps structured-output models reliable
// and well under Groq's per-minute token limits.
const PROFILE_README_CHARS = 2800;
const PROFILE_MANIFEST_CHARS = 1400;
const PROFILE_TREE_LINES = 50;
const PROFILE_MAX_FILES = 10;
const PROFILE_FILE_CHARS = 2000;

function contextToText(ctx: RepoContext): string {
  const lines: string[] = [
    `REPO: ${ctx.owner}/${ctx.repo}`,
    ctx.description ? `DESCRIPTION: ${ctx.description}` : "",
    `LANGUAGE: ${ctx.language ?? "unknown"}`,
    `STARS: ${ctx.stars}`,
    `FILES: ${ctx.totalFiles} total, ${ctx.includedFiles} analyzed`,
    "",
  ];

  if (ctx.readme) {
    lines.push("=== README ===");
    lines.push(ctx.readme.slice(0, PROFILE_README_CHARS));
    if (ctx.readme.length > PROFILE_README_CHARS) lines.push("... [truncated]");
    lines.push("");
  }

  if (ctx.manifest) {
    lines.push(`=== ${ctx.manifest.path} ===`);
    lines.push(ctx.manifest.content.slice(0, PROFILE_MANIFEST_CHARS));
    lines.push("");
  }

  lines.push("=== FILE TREE ===");
  lines.push(ctx.fileTree.split("\n").slice(0, PROFILE_TREE_LINES).join("\n"));
  lines.push("");

  lines.push("=== KEY SOURCE FILES (excerpts) ===");
  for (const file of ctx.files.slice(0, PROFILE_MAX_FILES)) {
    lines.push(`--- ${file.path} ---`);
    const body = file.content.slice(0, PROFILE_FILE_CHARS);
    lines.push(body);
    if (file.content.length > PROFILE_FILE_CHARS) lines.push("... [truncated]");
    lines.push("");
  }

  return lines.filter((l) => l !== null).join("\n");
}

export function buildAnalysisPrompt(ctx: RepoContext): string {
  return `Analyze this codebase and produce the interview profile:\n\n${contextToText(ctx)}`;
}
