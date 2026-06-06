import { streamText, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { buildInterviewerSystemPrompt } from "@/lib/interview";
import { createRepoTools } from "@/lib/repo-tools";
import { enforce } from "@/lib/rate-limit";
import type { ProjectProfile } from "@/lib/profile";
import type { PersonaId } from "@/lib/personas";
import type { ModelMessage } from "ai";

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

  const result = streamText({
    model: createGroq()("llama-3.3-70b-versatile"),
    system: buildInterviewerSystemPrompt(profile, fileTree, persona),
    messages,
    tools,
    // Allow the interviewer to read/search across a few tool calls before
    // it produces the next question. Tool steps emit no text; only the final
    // answer streams to the client.
    stopWhen: stepCountIs(5),
  });

  return result.toTextStreamResponse();
}
