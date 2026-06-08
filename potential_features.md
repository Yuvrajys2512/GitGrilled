# GitGrilled — Potential Features

Ideas to take GitGrilled from a solid Phase 1–5 app to something genuinely
impressive, ranked by impact-per-effort.

---

## Tier 0 — Wow factor ("damn, you built that?")

### AI video interviewer (talking avatar) ✅ *(done)*
Turns the interview into a mock *video* call. A stylized AI interviewer face
lip-syncs in real time to the Orpheus TTS, your webcam sits in the corner, and
call chrome (REC dot, timer, persona-themed interviewer) sells the illusion.

Shipped: `useSpeaker` routes TTS audio through a Web Audio analyser; `avatar.tsx`
samples amplitude each frame to drive the mouth (with a synthetic fallback for
browser TTS) and blinks on an idle timer, themed per persona; `webcam-pip.tsx`
shows the candidate's camera with graceful permission handling; a "video" toggle
in `interview-chat.tsx` swaps in the video-call layout with a live caption of the
current question. Free, real-time, zero new API keys.

### Roast-mode share card 🔥 ✅ *(done)*
The debrief now generates a single brutal, tweet-sized one-liner (`roast` field
on the debrief schema). A "🔥 Share roast" button builds a `/scorecard?...&m=roast`
link whose dynamic OG image is a meme-style burn card — huge centered quote, a
rotated grade stamp (CHEF'S KISS → INCINERATED), and the score in scorecard
colors. The scorecard page leads with the roast in roast mode, and falls back to
a score-based burn for older links. Pure viral fuel, reusing the existing
scorecard/OG pipeline.

Future wow ideas (not built): live coding challenge that runs your code in a
Vercel Sandbox; "it planted a bug in your own code"; panel interview (all
personas at once); live BS/confidence meter.

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

### 4. Persistence — profile cache + short share URLs ✅ *(first pass done)*
Everything was ephemeral. First pass adds Upstash Redis (reusing the rate-limit
integration, no new deps), all degrading gracefully when unconfigured:

Shipped: `lib/kv.ts` (REST KV helpers + short-id), `ProjectProfile` cached per
`owner/repo@treeSHA` in `/api/profile` (instant/free repeat visits & Try Again;
`X-Cache` header), and short share links — `/api/scorecard` stores a card and
returns a short id, `/scorecard?id=` + the OG route resolve it (`lib/load-scorecard.ts`),
and the debrief Share button uses the short id with the long `?d=` token as
fallback. Also fixed a latent OG-image crash (Satori "display: flex" on the
`owner/repo` node) that would have broken every social preview in production.

Not yet done (deferred from this pass): saving completed sessions / a history
view, and full mid-interview resume.

### 5. Private repos via GitHub OAuth
The single biggest limitation — people most want to be grilled on their own
(often private) work. "Sign in with GitHub" + a repo picker is a major
credibility unlock. Currently unauthenticated REST only.

### 6. Interviewer persona modes ✅ *(done)*
Let the user pick the interviewer, reshaping the system prompt.

Shipped: `lib/personas.ts` defines three personas — Senior Staff Engineer (cold,
default), Skeptical CTO (tradeoffs/scale/cost/risk), Friendly Senior (supportive
mentor). `buildInterviewerSystemPrompt` injects the persona's identity at the top
and its tone into the interview rules. A persona picker sits on the pre-interview
screen, threaded through session-client → InterviewChat → `/api/interview`.

---

## Tier 3 — Robustness & credibility

### 7. Use `generateObject` for the profile + debrief ✅ *(done)*
`session-client.tsx` and the debrief handler stripped markdown fences by hand and
`JSON.parse`ed a streamed string — fragile, and one malformed token failed the
whole session.

Shipped: `/api/profile` and `/api/debrief` now use the AI SDK's `generateObject`
with the existing Zod schemas, returning guaranteed schema-valid JSON (with a
one-retry guard against Groq's occasional strict-schema rejection). All
hand-rolled fence-stripping/partial-parsing is gone from the client. Note: this
required switching those two routes off `llama-3.3-70b` (no json_schema support)
to `llama-4-scout` (30k TPM, env-overridable via `GROQ_PROFILE_MODEL` /
`GROQ_DEBRIEF_MODEL`); the interview itself still uses llama-3.3-70b. Groq returns
structured output complete rather than streaming, so the profile/debrief now pop
in fully instead of filling field-by-field.

### 8. Finish Phase 6 — rate limiting + error boundaries ✅ *(done)*
All API routes were open and each burns GitHub quota + Groq tokens.

Shipped: `lib/rate-limit.ts` — a per-client, per-route limiter that uses Upstash
Redis when configured and falls back to in-memory otherwise (never throws).
Applied to every route (`analyze` 15/min, `profile` 12, `interview` 40,
`debrief` 10, `speak` 40, `file` 80) returning 429 + `Retry-After`. Client shows
rate-limit messaging, and `app/error.tsx` + `app/session/error.tsx` add error
boundaries. Remaining Phase 6 polish: mobile layout pass, SEO/OG on the landing
page, prod smoke test.

### 9. Smarter ingestion
`MAX_FILES = 35` + a static priority map misses interesting files in large repos.
Let the profiler drive a second pass — it already has live tools; have it request
the files it actually wants to probe instead of guessing up front.
