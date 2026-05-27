import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { buildInterviewerSystemPrompt } from "@/lib/interview";
import type { ProjectProfile } from "@/lib/profile";
import type { ModelMessage } from "ai";

export async function POST(req: Request) {
  const body = await req.json();
  const messages: ModelMessage[] = body.messages ?? [];
  const profile: ProjectProfile = body.profile;

  if (!profile) {
    return Response.json({ error: "Missing profile" }, { status: 400 });
  }

  const result = streamText({
    model: createGroq()("llama-3.3-70b-versatile"),
    system: buildInterviewerSystemPrompt(profile),
    messages,
  });

  return result.toTextStreamResponse();
}
