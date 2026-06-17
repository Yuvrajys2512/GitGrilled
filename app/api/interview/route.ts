import { streamText, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { buildInterviewerSystemPrompt } from "@/lib/interview";
import { createRepoTools } from "@/lib/repo-tools";
import { enforce } from "@/lib/rate-limit";
import type { ProjectProfile } from "@/lib/profile";
import type { PersonaId } from "@/lib/personas";
import type { ModelMessage } from "ai";

// The interviewer needs tool calling (listFiles/readFile/searchCode). Default is
// llama-3.3-70b; override via env to spread load across daily token budgets or
// use a different tool-capable model.
const INTERVIEW_MODEL = process.env.GROQ_INTERVIEW_MODEL ?? "llama-3.3-70b-versatile";

export async function POST(req: Request) {
  const limited = await enforce(req, "interview", 40);
  if (limited) return limited;

  const body = await req.json();
  const messages: ModelMessage[] = body.messages ?? [];
  const profile: ProjectProfile = body.profile;
  const owner: string = body.owner;
  const repo: string = body.repo;
  const branch: string = body.branch ?? "main";
  const fileTree: string | undefined = body.fileTree;
  const persona: PersonaId | undefined = body.persona;

  if (!profile) {
    return Response.json({ error: "Missing profile" }, { status: 400 });
  }
  if (!owner || !repo) {
    return Response.json({ error: "Missing repo owner/name" }, { status: 400 });
  }

  const { tools } = createRepoTools(owner, repo, branch);
  const groq = createGroq();
  const system = buildInterviewerSystemPrompt(profile, fileTree, persona);

  // Groq's tool-calling occasionally rejects its own generated function call
  // ("Failed to call a function. Please adjust your prompt.") — a transient
  // error, not a bad request. As long as nothing has reached the client yet,
  // it's safe to silently retry with a fresh streamText call. Once any part
  // has been forwarded, a retry would replay/duplicate output, so at that
  // point a failure is surfaced as a stream error instead.
  const MAX_ATTEMPTS = 6;

  // We stream NDJSON events instead of plain text so the client can show a live
  // "reading your code" trace: each tool call the interviewer makes (readFile /
  // searchCode / listFiles) is surfaced as it happens, then the answer text
  // streams in. One JSON object per line:
  //   {"t":"tool","name":"readFile","input":{"path":"lib/x.ts"}}
  //   {"t":"text","v":"...delta..."}
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      let sentAny = false;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const result = streamText({
          model: groq(INTERVIEW_MODEL),
          system,
          messages,
          tools,
          // Allow the interviewer to read/search across a few tool calls before
          // it produces the next question.
          stopWhen: stepCountIs(5),
        });
        let attemptFailed = false;
        try {
          for await (const part of result.fullStream) {
            if (part.type === "tool-call") {
              send({ t: "tool", name: part.toolName, input: part.input });
              sentAny = true;
            } else if (part.type === "text-delta") {
              send({ t: "text", v: part.text });
              sentAny = true;
            } else if (part.type === "error") {
              attemptFailed = true;
              break;
            }
          }
        } catch {
          attemptFailed = true;
        }
        if (!attemptFailed) break;
        if (sentAny) {
          send({ t: "error" });
          break;
        }
        // Nothing sent yet — safe to loop and try again on a fresh attempt.
        if (attempt === MAX_ATTEMPTS - 1) send({ t: "error" });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
