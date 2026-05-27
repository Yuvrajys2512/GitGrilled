import { streamObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { debriefSchema, buildDebriefPrompt, DEBRIEF_SYSTEM_PROMPT } from "@/lib/debrief";
import type { ProjectProfile } from "@/lib/profile";

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  const body = await req.json();
  const profile: ProjectProfile = body.profile;
  const conversation: ConversationTurn[] = body.conversation ?? [];

  if (!profile || conversation.length === 0) {
    return Response.json({ error: "Missing profile or conversation" }, { status: 400 });
  }

  const result = streamObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: debriefSchema,
    system: DEBRIEF_SYSTEM_PROMPT,
    prompt: buildDebriefPrompt(profile, conversation),
  });

  return result.toTextStreamResponse();
}
