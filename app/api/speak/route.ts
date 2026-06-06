// Text-to-speech for the interviewer's voice, via Groq's Orpheus TTS
// (OpenAI-compatible /audio/speech endpoint). Returns WAV audio bytes.
// On any failure (no key, model terms not accepted, etc.) we return a
// non-2xx status so the client falls back to the browser's speechSynthesis.

const GROQ_SPEECH_URL = "https://api.groq.com/openai/v1/audio/speech";
const MAX_TTS_CHARS = 1200; // questions are short; cap to bound latency/cost

export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return new Response("TTS not configured", { status: 503 });

  const { text } = await req.json().catch(() => ({ text: "" }));
  const input = String(text ?? "").trim().slice(0, MAX_TTS_CHARS);
  if (!input) return new Response("Empty text", { status: 400 });

  const model = process.env.GROQ_TTS_MODEL ?? "canopylabs/orpheus-v1-english";
  const voice = process.env.GROQ_TTS_VOICE ?? "daniel";

  try {
    const res = await fetch(GROQ_SPEECH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input,
        response_format: "wav",
      }),
    });

    if (!res.ok || !res.body) {
      // Surface a clean status so the client can fall back silently.
      return new Response("TTS upstream error", { status: 502 });
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("TTS request failed", { status: 502 });
  }
}
