# GitGrilled — Production Launch Plan

Status check before reading: the app already covers Phases 1–6 from `project.md`
plus most of Tier 0–3 from `potential_features.md` (interview engine, debrief,
voice mode, scorecards, personas, rate limiting, caching). This document is the
**remaining work to take it from "runs on my machine" to "live URL real
people can hit without it falling over, leaking, or costing a fortune."**

Check boxes off as you go (`- [ ]` → `- [x]`). Phases are roughly sequential —
later phases assume earlier ones are done — but Phase 4 (SEO/branding) can run
in parallel with Phase 2/3 if you want.

---

## Phase 0 — Repo Hygiene (quick wins, ~30 min)

- [x] Remove unused `@ai-sdk/anthropic` dependency from `package.json` (project
      fully runs on `@ai-sdk/groq` now — `bcc7013` switched providers but left
      the old package in)
- [x] Add a real `README.md` (currently only `project.md` / `potential_features.md`
      exist) — setup steps, env vars, `npm run dev`
- [x] Confirm `.env.local` is never committed (verified via `git log -p --all --
      .env.local .env` — clean history, nothing leaked)
- [x] Decide license (MIT/none) if the repo is going public — added `LICENSE` (MIT)

---

## Phase 1 — Secrets & Environment Setup

The app already degrades gracefully when optional env vars are missing, but
"degrades gracefully" in production means "silently worse for every user," so
get these set before launch, not after.

- [x] Get a production `GROQ_API_KEY` — reusing the existing dev key for now
      (pragmatic call, see Phase 10 follow-up to split dev/prod keys later)
- [x] **Get a `GITHUB_TOKEN`** — fine-grained PAT created, verified at 5,000/hr
      ceiling and confirmed it can read arbitrary public repos (tested against
      `torvalds/linux` and `vercel/next.js`), added to Vercel Production + local
      `.env.local`
- [x] Production Upstash Redis DB already existed (`unique-quail-144259`) — REST
      URL/token reused
- [ ] Set `NEXT_PUBLIC_SITE_URL` explicitly to the final domain (don't rely on
      Vercel auto-detection — it affects OG image URLs and share links) —
      blocked on Phase 9 domain decision
- [x] Add env vars in Vercel Project Settings → Environment Variables —
      `GROQ_API_KEY`, `GITHUB_TOKEN`, `UPSTASH_REDIS_REST_URL`,
      `UPSTASH_REDIS_REST_TOKEN` all set on Production via `vercel env add`.
      Preview environment hit a CLI bug (see Phase 1 follow-up) — add via
      dashboard manually before relying on PR preview deploys
- [x] Document every required/optional var — done in `README.md` (links to
      `.env.local.example`)

---

## Phase 2 — Data & Infra

- [x] Provision Upstash Redis for production — already had one (`unique-quail-144259`),
      wired into Vercel Production env (see Phase 1)
- [ ] Verify with prod env vars locally that `lib/kv.ts` and `lib/rate-limit.ts`
      pick up Upstash (check for `X-Cache` header on a repeat `/api/profile`
      call, and that rate-limit 429s persist across requests instead of resetting)
- [ ] Decide Redis eviction/TTL is sane for scorecard storage (`lib/kv.ts`) —
      confirm short-link scorecards don't grow unbounded on the free tier
- [ ] Set a budget alert on Groq usage (console.groq.com) so a traffic spike
      or abuse doesn't surprise you with a bill or a hard cutoff mid-launch
- [ ] Set a budget/limit awareness on Upstash too (free tier request caps)

---

## Phase 3 — Security & Abuse Prevention

The rate limiter (`lib/rate-limit.ts`) and per-route limits (`b28a005`) are
already solid. What's left is closing gaps an anonymous public tool invites.

- [x] Add a max-repo-size / file-count guard before ingestion — added
      `MAX_TOTAL_CONTENT_CHARS = 120_000` in `lib/github.ts`; the batch fetch
      loop now stops once combined file content hits that ceiling, so a repo of
      35 near-max files (or a pathological monorepo) can't blow the Groq token
      budget. Per-file (`MAX_FILE_CHARS`) and count (`MAX_FILES`) caps unchanged
- [x] Add a request timeout on outbound GitHub fetches — all three fetch paths
      (`ghFetch`, `fetchFileContent`, `fetchRawFile`) now pass
      `AbortSignal.timeout(10_000)` so a hung connection can't pin a function
- [x] Re-check `clientId()` in `lib/rate-limit.ts` — the leftmost
      `x-forwarded-for` hop is client-spoofable (mint a fresh limit bucket per
      request). Now prefers `x-real-ip` (Vercel overwrites this with the true
      peer; a client can't forge it), falling back to the *rightmost*
      x-forwarded-for hop instead of the spoofable leftmost one
- [x] Confirm no API route trusts client-supplied data it didn't generate
      itself — found via live smoke testing: `/api/scorecard` accepted any
      `categories` shape and `/api/og` crashed with an unhandled 500 reading
      `.name` off a malformed entry. Fixed both: `/api/scorecard` now rejects
      malformed `categories` at write time (400), and `/api/og` defensively
      filters bad entries instead of crashing, so old/garbage stored cards
      degrade gracefully. `/api/debrief`'s `profile`/`conversation` input is
      still unvalidated against the Zod schemas — same class of risk, lower
      severity since a bad shape there fails the LLM call rather than
      corrupting stored/shared state. **Done now:** `/api/debrief` validates
      `profile` against `projectProfileSchema` and `conversation` against a Zod
      turn schema (`safeParse` → 400 on malformed input) before any Groq call.
- [x] Add CORS lockdown if these API routes don't need to be called
      cross-origin — confirmed via grep: no `Access-Control-Allow-Origin` is
      set anywhere in the app. Default Next.js same-origin behavior is intact;
      nothing to lock down
- [x] Harden remaining API routes for consistency — `/api/file` now rejects
      path-traversal/absolute `path` values (user input flows into a raw
      GitHub URL); `/api/speak` got a 15s outbound timeout + structured
      logging on TTS upstream failures (previously silent)
- [x] Run `npm audit` and resolve high/critical findings — fixed via
      `npm audit fix` (`hono`/`js-yaml`, both devDependency tooling from
      `eslint`/`shadcn` CLI, not in the runtime bundle). One moderate finding
      remains nested in Next's own bundled `postcss` (`node_modules/next/node_modules/postcss`);
      the only fix path force-downgrades `next` to `9.x`, which is worse than
      the issue — left as an accepted risk, re-check on the next Next.js bump
- [ ] Webcam access (`webcam-pip.tsx`) — confirm video/audio never leaves the
      browser (it shouldn't, since voice is Web Speech API + local TTS
      analysis) and there's a visible mic/camera permission explanation, not
      just a silent browser prompt

---

## Phase 4 — SEO, Branding & Metadata

- [x] Replace default Next.js placeholder icons in `public/` — removed all five
      scaffold SVGs (`next/vercel/file/globe/window.svg`); confirmed none were
      referenced in source. `public/` is now empty (favicon lives in `app/`)
- [x] Add a real favicon — removed the default `app/favicon.ico` and added
      generated brand-mark icons via `app/icon.tsx` (32px favicon) and
      `app/apple-icon.tsx` (180px iOS), a "G" in flame-orange on near-black
- [x] Add `app/robots.ts` and `app/sitemap.ts` — both added. robots allows `/`,
      disallows `/api/`, `/session`, `/scorecard`; sitemap lists the landing
      page only (session/scorecard are per-run, query-param driven). Origin
      comes from the new shared `lib/site.ts` `siteUrl()` helper
- [x] Verify the static OG image / metadata covers the landing page itself —
      added `openGraph` + `twitter` metadata to `app/layout.tsx`, and
      `/api/og` now renders a branded marketing card when called with no
      scorecard params (was rendering a hollow "unknown/repo 0/10" card)
- [ ] Test the dynamic OG image renders correctly when shared on actual
      Twitter/X, LinkedIn, Slack, and Discord — still needs a manual pass with
      their preview/debug tools after deploy
- [x] Add a short, human meta description distinct from the dev-facing one —
      rewrote `metadata.description` to a human, share-facing sentence; shared
      across OG/Twitter tags

---

## Phase 5 — Observability & Monitoring

Right now there's no error tracking beyond `app/error.tsx` /
`app/session/error.tsx` boundaries (good, but they only catch render errors,
not silent API failures or Groq/GitHub outages).

- [ ] Add an error tracking service (Sentry's Vercel integration is the path
      of least resistance) so failed `/api/*` routes surface somewhere other
      than a user's console — still needs the dashboard install
- [x] Add basic analytics — wired `@vercel/analytics` + `@vercel/speed-insights`
      into `app/layout.tsx` (cookieless). Flip on Web Analytics + Speed Insights
      in the Vercel dashboard to start collecting; disclosed on `/privacy`
- [x] Log (structured, not `console.log` spam) key failure points — added
      `lib/log.ts` (JSON-line structured logger + `errMessage` helper) and
      wired it into the real failure points: GitHub fetch errors / rate limits
      (`/api/analyze`), Groq generation failures (`/api/profile`, `/api/debrief`),
      interview retry/exhaustion (`/api/interview` — so the residual failure
      rate is finally observable), and Upstash limiter outages (`lib/rate-limit.ts`)
- [ ] Set up a Vercel deployment notification (Slack/email) so failed builds
      don't go unnoticed
- [x] Add a `/api/health` lightweight check — added `app/api/health/route.ts`;
      reports groq/github/redis status (pings Upstash with a 3s timeout),
      returns 200 healthy / 503 degraded, never leaks secret values. Point an
      external uptime monitor at it

---

## Phase 6 — Performance & Cross-Device QA

- [ ] Mobile-responsive pass — explicitly called out as unfinished in
      `potential_features.md` (#8). Test the landing page, session chat, video
      avatar mode, and scorecard page on a real phone viewport
- [ ] Run Lighthouse on the landing page and `/session`; fix anything red
      (font loading, layout shift, JS bundle size)
- [x] Manually smoke-test the full golden path end-to-end against the live
      deployment (analyze → profile → interview → debrief → scorecard → both
      OG image variants) — all green after two fixes found along the way:
      (1) the interview's tool-calling reliability bug (see Phase 1/3 note
      below — fixed with a bounded retry), (2) the `/api/scorecard` +
      `/api/og` malformed-data crash (see Phase 3). Not yet tested through
      the actual browser UI end-to-end (this pass was API-level via curl) —
      do a manual click-through pass before public launch.
- [ ] Test edge cases: a private repo (should error cleanly, not 500), a
      nonexistent repo, a huge repo (e.g. `torvalds/linux`), a repo with no
      README, an empty repo
- [ ] Test voice mode and the AI video avatar in at least Chrome + Safari
      (Web Speech API support differs meaningfully between them — confirm the
      stated "graceful fallback" actually triggers in Safari/Firefox)
- [ ] Verify behavior when `GROQ_API_KEY` rate limits or errors mid-interview
      — does the user see a sane message or a stuck spinner?
- [x] **Found in smoke testing:** Groq's tool-calling on the default interview
      model (`llama-3.3-70b-versatile`) rejected its own generated function
      call (`Failed to call a function. Please adjust your prompt.`) on
      roughly **half** of opening-turn requests in local testing — a real,
      frequent failure, not an edge case. Fixed in `app/api/interview/route.ts`:
      retries with a fresh `streamText` call (up to 6 attempts) as long as
      nothing has been sent to the client yet; only surfaces an error once
      partial output already streamed (can't safely replay). Brought failure
      rate from ~40% down to ~12.5% in an 8-run sample; the residual failure
      mode is a real one (all 6 attempts fail), with up to ~80s of latency
      before the user sees the error. Tested swapping to
      `GROQ_INTERVIEW_MODEL=openai/gpt-oss-120b` as an alternative — 0/5
      failures, but noticeably slower per turn and a lower Groq TPM ceiling.
      Decision: kept the default model + higher retry count for now. If the
      residual failure rate proves too high under real traffic, revisit the
      model swap (no code change needed, just the env var).

---

## Phase 7 — Legal & Trust Basics

Public tool, takes a GitHub URL, requests camera/mic permission, processes
third-party code through a third-party LLM API — minimal disclosure is
warranted even for a side project.

- [x] Add a short Privacy note — added `app/privacy/page.tsx` covering what's
      sent to Groq (public repo file contents + answers), what's stored
      (shared scorecards 30d, brief analysis cache), and what never leaves the
      browser (camera/mic streams). Linked from the landing-page footer
- [x] Add a one-line disclaimer that analysis is AI-generated and may be wrong
      — landing-page footer carries the disclaimer + privacy link, and the
      privacy page restates it more fully
- [ ] If targeting EU/UK visitors at all, a minimal cookie/analytics notice
      if you add Phase 5 analytics that use cookies

---

## Phase 8 — CI/CD

No `.github/workflows` exist yet — currently everything ships straight from
local `npm run build` / Vercel's own build step.

- [x] Add a GitHub Actions workflow — `.github/workflows/ci.yml` runs
      `npm run lint` + `npx tsc --noEmit` + `npm run build` on every PR to
      `main` and on pushes to `main` (Node 24, npm cache, dummy build-time
      `GROQ_API_KEY`). All three pass locally as of this session
- [ ] Confirm Vercel's Git integration is connected to this repo with
      production = `main` and preview deployments on every PR (if not already)
- [ ] Decide branch protection on `main` (require the CI check above to pass)

---

## Phase 9 — Domain & Deployment

- [x] Vercel project linked (`yuvraj-srivastavas-projects/gitgrilled`), GitHub
      repo auto-connected for Git-based deploys, live now at
      **https://gitgrilled.vercel.app** — shipping on the default domain for
      now, custom domain deferred
- [ ] Pick and buy/configure a custom production domain (optional — current
      `*.vercel.app` URL works fine for v1/soft launch)
- [ ] Add the domain in Vercel → Project → Domains, verify DNS, confirm HTTPS
      is active (only if doing a custom domain)
- [ ] Set `NEXT_PUBLIC_SITE_URL` to match the final domain exactly (only
      needed once/if a custom domain is added — `*.vercel.app` is
      auto-detected correctly already)
- [x] Did a production deploy and re-ran the Phase 6 golden-path smoke test
      against the real live URL (not just preview) — see Phase 6 for what
      was found and fixed along the way

---

## Phase 10 — Launch

- [ ] Soft launch to a small group first (friends, a private Discord) before
      any public post — confirms rate limits and Groq budget hold up under
      real concurrent use
- [ ] Watch error tracking + Groq/Upstash dashboards for the first hour after
      any public share (Twitter/HN/Reddit)
- [ ] Have a rollback plan ready: know how to instantly revert to the last
      good Vercel deployment if something breaks post-launch
- [ ] Post-launch: revisit `potential_features.md` Tier 1/2 items not yet
      shipped (GitHub OAuth for private repos, session history) now that the
      thing is live and you know what users actually ask for
