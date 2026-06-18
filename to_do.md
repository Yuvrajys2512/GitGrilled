# GitGrilled — Next Session To-Do

Live at **https://gitgrilled.vercel.app**. This is the punch list for next
time — pulled from `production.md` (the full plan with context/reasoning
lives there; check things off in both files as you go). Roughly ordered by
priority, not strict phase order.

---

## Carried over from this session (small, do these first)

- [ ] **Add env vars to Vercel Preview environment via the dashboard.**
      `vercel env add ... preview` hit a CLI bug (kept demanding a git branch
      even with `--value`/`--yes` matching its own suggested fix exactly).
      Production env vars are fine — this only affects PR preview deploys.
      Go to vercel.com → gitgrilled project → Settings → Environment Variables
      → add `GROQ_API_KEY`, `GITHUB_TOKEN`, `UPSTASH_REDIS_REST_URL`,
      `UPSTASH_REDIS_REST_TOKEN` to Preview (all branches).
- [ ] **Manual browser click-through of the golden path.** Everything verified
      this session was API-level (curl against the live deployment). Actually
      open https://gitgrilled.vercel.app in a browser and run through: paste
      a repo → watch analysis stream → answer a few interview questions →
      hit debrief → share a scorecard → open the share link fresh.
- [ ] **Split dev/prod credentials.** Currently reusing your personal
      `GROQ_API_KEY` for both local dev and Vercel Production. Fine for now,
      but get a dedicated prod key so you can rotate/track usage independently.
- [ ] **Watch the interview's residual failure rate.** Fixed the Groq
      tool-calling bug from ~40% to ~12.5% failure (retry logic in
      `app/api/interview/route.ts`), but it's not zero — worst case is ~80s
      wait then an error. If this shows up too often with real users, swap
      `GROQ_INTERVIEW_MODEL=openai/gpt-oss-120b` in Vercel env (tested at 0/5
      failures, but slower per turn + lower Groq TPM ceiling — no code
      change needed, just the env var).

---

## High-value next (pick based on what you care about most)

- [~] **Phase 5 — Observability.** DONE in code: `lib/log.ts` structured
      logging wired into all GitHub/Groq/Upstash/interview failure points, a
      `/api/health` endpoint, and `@vercel/analytics` + `@vercel/speed-insights`
      in the layout. STILL TODO (dashboard): toggle on Web Analytics + Speed
      Insights in the Vercel project, and install Sentry's Vercel integration
      so errors surface off-box.
- [ ] **Phase 6 — Mobile pass.** Never explicitly tested. Open the landing
      page, session chat, video avatar mode, and scorecard page on an actual
      phone.
- [x] **Phase 4 — SEO/branding cleanup.** DONE: removed the scaffold icons,
      added `app/robots.ts` + `app/sitemap.ts`, added landing OG/Twitter
      metadata + a branded no-param `/api/og` card + a human meta description.
      (Still worth a manual share-preview test on Twitter/LinkedIn after deploy,
      and a real favicon someday.)
- [x] **Phase 3 — Remaining hardening.** DONE: `clientId()` now prefers the
      unspoofable `x-real-ip` (rightmost x-forwarded-for fallback);
      `/api/debrief` validates `profile`/`conversation` with Zod; total-content
      cap in `lib/github.ts`; 10s timeouts on all outbound GitHub fetches; CORS
      confirmed locked (none set).

---

## Lower priority / do when you get to it

- [ ] Phase 2: confirm Upstash free-tier TTL/eviction is sane for scorecard
      storage long-term (not urgent at current traffic).
- [ ] Phase 2 / Groq console: set a budget alert so a traffic spike doesn't
      surprise you with a bill.
- [x] Phase 7: short privacy note + AI-generated-content disclaimer — added
      `app/privacy/page.tsx` + landing-page footer disclaimer/link. (Cookie
      notice still N/A until cookie-based analytics are added.)
- [x] Phase 8: GitHub Actions CI (lint + typecheck + build on PRs) — added
      `.github/workflows/ci.yml`. STILL TODO (dashboard): turn on branch
      protection on `main` to *require* this check before merge.
- [ ] Phase 9: custom domain, if you want one (current `*.vercel.app` URL
      works fine for a soft launch).
- [ ] Phase 10: soft-launch to a small group first and watch error
      tracking/Groq/Upstash dashboards before any public post.

---

## Don't forget

- `production.md` has the full reasoning behind every item above plus
  everything already done — read it if a checkbox here is unclear.
- This file (`to_do.md`) is the quick-glance version; update both as items
  get done.
