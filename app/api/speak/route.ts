// Text-to-speech for the interviewer's voice.
//
// Primary provider is Microsoft Edge's free neural TTS (no API key) — its
// voices (e.g. en-GB-RyanNeural, a calm British male) sound markedly more human
// than Groq's Orpheus model. Groq Orpheus is kept as a secondary, and the
// client falls back to the browser's speechSynthesis if both return non-2xx.
//
// Provider order is controlled by TTS_PROVIDER: "edge" (default) | "groq" |
// "browser" (skip server TTS entirely).

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { enforce } from "@/lib/rate-limit";
import { log, errMessage } from "@/lib/log";

export const runtime = "nodejs"; // Edge TTS uses a Node WebSocket + streams
export const dynamic = "force-dynamic";

const GROQ_SPEECH_URL = "https://api.groq.com/openai/v1/audio/speech";
const MAX_TTS_CHARS = 1200; // questions are short; cap to bound latency/cost
const TTS_TIMEOUT_MS = 15_000; // don't let a hung TTS request pin the function

// ─── Microsoft Edge neural TTS (free, no key) ────────────────────────
// en-GB-RyanNeural is a calm, refined British male — the closest free voice to
// a Jarvis read. Override with EDGE_TTS_VOICE; tune cadence with EDGE_TTS_RATE
// / EDGE_TTS_PITCH (SSML relative values, e.g. "-6%" / "-2st").
const EDGE_VOICE = process.env.EDGE_TTS_VOICE ?? "en-GB-RyanNeural";
const EDGE_RATE = process.env.EDGE_TTS_RATE ?? "-6%";
const EDGE_PITCH = process.env.EDGE_TTS_PITCH ?? "-2st";

async function edgeSpeak(input: string): Promise<Response> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(EDGE_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(input, { rate: EDGE_RATE, pitch: EDGE_PITCH });

    const buf = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => reject(new Error("edge tts timeout")), TTS_TIMEOUT_MS);
      audioStream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      audioStream.on("end", () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });
      audioStream.on("error", (e: Error) => {
        clearTimeout(timer);
        reject(e);
      });
    });

    if (buf.length === 0) throw new Error("edge tts returned empty audio");

    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } finally {
    try {
      tts.close();
    } catch {
      // already closed / never connected — nothing to clean up
    }
  }
}

// ─── Groq Orpheus TTS (secondary) ────────────────────────────────────
// Orpheus reads flat with no direction, so prepend a bracketed "vocal
// direction" tag (e.g. [calm]) for a more composed delivery. Disable with an
// empty GROQ_TTS_STYLE.
function vocalStyle(): string {
  const raw = process.env.GROQ_TTS_STYLE;
  return raw === undefined ? "[calm]" : raw.trim();
}

async function groqSpeak(input: string): Promise<Response> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return new Response("TTS not configured", { status: 503 });

  const model = process.env.GROQ_TTS_MODEL ?? "canopylabs/orpheus-v1-english";
  const voice = process.env.GROQ_TTS_VOICE ?? "daniel";
  const style = vocalStyle();
  const directed = style ? `${style} ${input}` : input;

  const res = await fetch(GROQ_SPEECH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, voice, input: directed, response_format: "wav" }),
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
  });

  if (!res.ok || !res.body) {
    log.warn("speak.groq_upstream_error", { model, status: res.status });
    return new Response("TTS upstream error", { status: 502 });
  }

  return new Response(res.body, {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const limited = await enforce(req, "speak", 40);
  if (limited) return limited;

  const provider = (process.env.TTS_PROVIDER ?? "edge").toLowerCase();

  // Force the browser's built-in voice by skipping server TTS. The client falls
  // back to speechSynthesis on any non-2xx here. (GROQ_TTS_DISABLED kept for
  // back-compat.)
  if (provider === "browser" || process.env.GROQ_TTS_DISABLED === "1") {
    return new Response("Server TTS disabled", { status: 503 });
  }

  const { text } = await req.json().catch(() => ({ text: "" }));
  const input = String(text ?? "").trim().slice(0, MAX_TTS_CHARS);
  if (!input) return new Response("Empty text", { status: 400 });

  if (provider === "groq") {
    try {
      return await groqSpeak(input);
    } catch (err) {
      log.warn("speak.groq_failed", { error: errMessage(err) });
      return new Response("TTS request failed", { status: 502 });
    }
  }

  // Default: Edge neural TTS, falling back to Groq Orpheus, then (via non-2xx)
  // the browser voice.
  try {
    return await edgeSpeak(input);
  } catch (err) {
    log.warn("speak.edge_failed", { voice: EDGE_VOICE, error: errMessage(err) });
    try {
      return await groqSpeak(input);
    } catch (err2) {
      log.warn("speak.groq_fallback_failed", { error: errMessage(err2) });
      return new Response("TTS request failed", { status: 502 });
    }
  }
}
