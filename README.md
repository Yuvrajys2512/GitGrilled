# GitGrilled

Drop in a public GitHub repo URL. The AI reads the codebase and grills you
about it like a senior engineer interviewer — architecture, implementation
choices, debugging scenarios, scaling trade-offs, security, testing. No
softballs. Ends in a scored, shareable debrief.

See [`project.md`](./project.md) for the original scope/phases and
[`potential_features.md`](./potential_features.md) for what's shipped beyond
that. See [`production.md`](./production.md) for the live-launch checklist.

## Stack

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, Vercel AI SDK on
Groq (Llama models) for analysis/interview/debrief, GitHub REST API for repo
ingestion, optional Upstash Redis for rate limiting + profile caching + short
share links.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in at least GROQ_API_KEY
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | Yes | Powers analysis, interview, and debrief generation |
| `GITHUB_TOKEN` | Recommended | Unauthenticated GitHub API is capped at 60 req/hr/IP — a classic PAT (no scopes needed) bumps that to 5,000/hr |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Recommended | Distributed rate limiting, profile caching, short `/scorecard?id=` links. Falls back to in-memory/long-URL behavior if unset |
| `NEXT_PUBLIC_SITE_URL` | Recommended in prod | Absolute site URL for OG images and share links. Auto-detected on Vercel, but set explicitly once you have a domain |
| `GROQ_TTS_MODEL` / `GROQ_TTS_VOICE` | No | Interviewer voice (Groq Orpheus TTS). Falls back to the browser's built-in voice |
| `GROQ_PROFILE_MODEL` / `GROQ_DEBRIEF_MODEL` / `GROQ_INTERVIEW_MODEL` | No | Override the default Groq models per route |

Full details and defaults are in [`.env.local.example`](./.env.local.example).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build locally
- `npm run lint` — eslint
