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

- [ ] **Phase 5 — Observability.** Right now a Groq outage or GitHub 403 just
      fails silently into a generic error for the user, with nothing on your
      end. Add Sentry (Vercel's integration is one click) and/or Vercel
      Analytics so you're not flying blind once real traffic hits.
- [ ] **Phase 6 — Mobile pass.** Never explicitly tested. Open the landing
      page, session chat, video avatar mode, and scorecard page on an actual
      phone.
- [ ] **Phase 4 — SEO/branding cleanup.** `public/` still has the default
      Next.js scaffold icons (`vercel.svg`, `next.svg`, etc.) and there's no
      `robots.ts` / `sitemap.ts`. Quick, low-risk polish.
- [ ] **Phase 3 — Remaining hardening.** `clientId()` in `lib/rate-limit.ts`
      trusts `x-forwarded-for`, which is spoofable — check what Vercel
      actually exposes for trusted client IP. Also: `/api/debrief` still
      doesn't validate its `profile`/`conversation` input against the
      existing Zod schemas (same class of bug as the scorecard one fixed
      this session, lower severity).

---

## Lower priority / do when you get to it

- [ ] Phase 2: confirm Upstash free-tier TTL/eviction is sane for scorecard
      storage long-term (not urgent at current traffic).
- [ ] Phase 2 / Groq console: set a budget alert so a traffic spike doesn't
      surprise you with a bill.
- [ ] Phase 7: short privacy note + AI-generated-content disclaimer (public
      tool takes a GitHub URL, requests camera/mic, sends repo content to a
      third-party LLM — minimal disclosure is reasonable even for a side
      project).
- [ ] Phase 8: GitHub Actions CI (lint + typecheck + build on PRs) — currently
      nothing blocks a broken PR from merging.
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
