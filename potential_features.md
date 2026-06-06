# GitGrilled — Potential Features

Ideas to take GitGrilled from a solid Phase 1–5 app to something genuinely
impressive, ranked by impact-per-effort.

---

## Tier 1 — "Wow in the first 30 seconds" (demo wins)

### 1. Voice mode 🎙️ *(in progress)*
Right now the interview is a text chat. A real interview is *spoken*. Add a live
voice mode: browser speech-to-text for the candidate's answers, text-to-speech
for the interviewer's questions. This single feature turns the demo from "another
LLM chat wrapper" into "holy crap, it's interviewing me." The streaming we already
have makes it feel natural.

- STT: Web Speech API (`SpeechRecognition`) — zero deps, zero cost, built into
  Chrome/Edge. Dictate answers straight into the input.
- TTS: Web Speech API (`speechSynthesis`) to read each question aloud as it lands.
- Toggle so the classic text chat still works; graceful fallback when the browser
  has no speech support.
- Upgrade path: swap browser TTS for a real voice API (Groq PlayAI / ElevenLabs /
  OpenAI) for a far more convincing interviewer voice.

### 2. Shareable debrief scorecard + dynamic OG image 📊 *(in progress)*
People share scores. Generate a `/scorecard` page showing the repo, overall
score, per-category bars, and a blunt verdict — with a dynamic `next/og` image so
posting the link on Twitter/Slack/LinkedIn renders a real preview card. This is
the viral loop: every shared card is an ad.

- No DB required for v1: encode a compact scorecard payload into the share URL
  (base64url), so the page and its OG image are fully self-contained.
- "Share scorecard" button on the debrief that builds + copies the link.
- Upgrade path: persist scorecards (Tier 2 #4) for short URLs + a history.

### 3. Clickable code citations in chat ✅ *(done)*
The interviewer already cites `lib/github.ts:142`, but as plain text. Parse
`path:line` references and render them as expandable, syntax-highlighted snippets
(we already fetch files via `fetchRawFile`). Makes the grilling feel grounded.

Shipped: `lib/citations.ts` (parser, handles ranges + backticks), `app/api/file`
(raw file fetch), `lib/highlight.tsx` (dependency-free per-line highlighter),
`app/session/code-citation.tsx` (expandable snippet with the cited line
highlighted) + `message-content.tsx`, wired into the interview chat.

---

## Tier 2 — Product depth (makes it a real product, not a toy)

### 4. Persistence + resume
Everything is ephemeral today. Add a lightweight store (Neon Postgres / Vercel
Blob) to save sessions, cache `ProjectProfile` per repo + commit SHA, and let
users resume or review past interviews. Caching the profile alone makes "Try
Again" instant and slashes AI cost.

### 5. Private repos via GitHub OAuth
The single biggest limitation — people most want to be grilled on their own
(often private) work. "Sign in with GitHub" + a repo picker is a major
credibility unlock. Currently unauthenticated REST only.

### 6. Difficulty / persona modes
Let the user pick the interviewer: "FAANG staff engineer," "skeptical CTO,"
"friendly senior." We already have a `difficulty` enum on probe areas — expose it
as a user choice that reshapes the system prompt.

---

## Tier 3 — Robustness & credibility

### 7. Use `streamObject` / `generateObject` for the profile
`session-client.tsx` strips markdown fences by hand and `JSON.parse`es a streamed
string — fragile, and one malformed token fails the whole session. The AI SDK's
structured output with our existing Zod `projectProfileSchema` makes this reliable
and lets us stream profile fields as they fill in.

### 8. Finish Phase 6
No rate limiting exists yet — `/api/analyze`, `/api/profile`, `/api/interview`
are all open and each burns GitHub quota + Groq tokens. Add rate limiting
(Upstash Redis), graceful 429 handling, and error boundaries.

### 9. Smarter ingestion
`MAX_FILES = 35` + a static priority map misses interesting files in large repos.
Let the profiler drive a second pass — it already has live tools; have it request
the files it actually wants to probe instead of guessing up front.
