import { z } from "zod";
import type { ProjectProfile } from "./profile";

export const categoryScoreSchema = z.object({
  category: z.string(),
  score: z.number().min(1).max(10),
  notes: z.string().describe("1-2 sentences on what they did well or poorly in this category"),
});

export const debriefSchema = z.object({
  overallScore: z.number().min(1).max(10),
  verdict: z.string().describe("Blunt 2-3 sentence honest summary of performance"),
  roast: z
    .string()
    .describe(
      "ONE savage, funny, screenshot-worthy one-liner roasting the candidate's performance. Tweet-sized (under 140 chars), punchy, no preamble, no hedging. Think comedy-roast burn, not a clinical note. It should make people laugh and want to share it."
    ),
  categories: z.array(categoryScoreSchema).describe("Score each probe area that was covered"),
  strongAreas: z.array(z.string()).describe("Things they genuinely understood well"),
  weakAreas: z.array(z.string()).describe("Things they were vague, wrong, or avoided"),
  fumbledQuestions: z.array(
    z.object({
      question: z.string().describe("The specific question they struggled with"),
      whatWentWrong: z.string().describe("Exactly why the answer was insufficient"),
    })
  ).describe("2-4 questions where the candidate most clearly showed knowledge gaps"),
  studyTopics: z.array(z.string()).describe("Concrete topics they should study to fix the gaps"),
});

export type Debrief = z.infer<typeof debriefSchema>;

export const DEBRIEF_SYSTEM_PROMPT = `You are evaluating a technical interview you just conducted.
Review the conversation transcript and give an honest, unsparing assessment of the candidate's performance.

Rules:
- Score 1–10 where 7 = solid pass, 5 = borderline, 3 = poor
- Be specific: reference actual answers they gave, not generic impressions
- fumbledQuestions should quote or closely paraphrase what the candidate actually said
- Don't inflate scores because they were "trying" — evaluate what they demonstrated
- If the transcript contains a [BUG_HUNT] challenge, explicitly judge whether the candidate found and correctly explained the bug — catching it is a strong positive signal; missing it belongs in weakAreas
- If they dodged a question, noted it as a weak area
- The "roast" is a single brutal, funny one-liner for a shareable card — make it land. Roast the candidate's actual performance (vagueness, dodges, hand-waving), never anything personal. The harsher the score, the harsher the burn; a strong performance gets a cocky, begrudging-respect burn instead`;

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export function buildDebriefPrompt(
  profile: ProjectProfile,
  conversation: ConversationTurn[],
  hintsUsed = 0
): string {
  const transcript = conversation
    .filter((m) => m.content !== "__BEGIN__" && m.content !== "__HINT__")
    .map((m) => `${m.role === "user" ? "CANDIDATE" : "INTERVIEWER"}: ${m.content}`)
    .join("\n\n");

  const hintNote =
    hintsUsed > 0
      ? `\nThe candidate asked for ${hintsUsed} hint${hintsUsed === 1 ? "" : "s"} during the interview (each marked [HINT]). Needing hints to reach an answer signals weaker independent understanding — factor it into the score and call it out if it was significant.\n`
      : "";

  return `PROJECT: ${profile.summary}

Stack: ${profile.stack.language}${profile.stack.framework ? ` / ${profile.stack.framework}` : ""}

Probe areas that were intended:
${profile.probeAreas.map((a) => `- ${a.topic} [${a.difficulty}]`).join("\n")}
${hintNote}
=== INTERVIEW TRANSCRIPT ===

${transcript}

=== END TRANSCRIPT ===

Now produce the debrief.`;
}
