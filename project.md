# GitGrilled

## Idea

You drop in a GitHub repo URL. The AI fetches and analyzes the entire codebase — architecture, tech stack, design decisions, implementation patterns — then grills you like a senior engineer interviewer would. No softball questions. No hand-holding. Real questions about why you made specific decisions, how you'd debug edge cases, how you'd scale it, what trade-offs you accepted, and whether you actually understand the code you wrote.

The goal: be interview-ready for questions about your own project.

---

## Scope

### In scope
- Paste a public GitHub repo URL to start a session
- AI fetches and parses repo contents (code files, README, config files, package manifests)
- AI builds a project intelligence profile: stack, architecture, entry points, key modules
- AI conducts a multi-turn interview session with hard, contextual questions
- Questions span: architecture decisions, implementation details, debugging scenarios, scaling trade-offs, security considerations, testing strategy, and conceptual depth
- AI evaluates answers and asks follow-up questions — doesn't let vague answers slide
- Post-session summary: what you answered well, where you fumbled, knowledge gaps

### Out of scope (v1)
- Private repos (requires OAuth, deferred)
- Saving/resuming sessions
- Multiple simultaneous users per session
- Voice interface
- Code execution / sandbox

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR, streaming, API routes in one repo |
| Language | TypeScript | Type safety across frontend and backend |
| Styling | Tailwind CSS + shadcn/ui | Fast, accessible UI components |
| AI | Vercel AI SDK + Claude claude-sonnet-4-6 | Streaming, tool use, multi-turn conversation |
| GitHub Data | GitHub REST API (unauthenticated, public repos) | No OAuth needed for v1 |
| Deployment | Vercel (Fluid Compute) | Streaming support, zero config |
| State | React state + URL params | No DB needed for v1 (session is ephemeral) |

---

## Development Phases

---

### Phase 1 — Project Scaffold + UI Shell
**Goal:** Running app with navigation, landing page, and repo input form.

**Tasks:**
- Init Next.js 15 project with TypeScript, Tailwind, shadcn/ui
- Build landing page: headline, value prop, repo URL input
- Build `/session` route shell (empty, just layout)
- Input validation: must be a valid `github.com/owner/repo` URL
- Error states: invalid URL, repo not found

**Verifiable output:**
- `npm run dev` starts without errors
- Landing page renders with a URL input field
- Valid GitHub URL navigates to `/session` route
- Invalid URL shows inline error message

---

### Phase 2 — GitHub Repo Ingestion Pipeline
**Goal:** Given a repo URL, fetch and structure the codebase into something the AI can reason over.

**Tasks:**
- GitHub API integration: fetch repo tree (recursive), README, package.json / requirements.txt / go.mod etc.
- File content fetcher: pull text content of relevant files (exclude binaries, node_modules, lock files, `.git`)
- Smart truncation: stay within token budget — prioritize entry points, config files, key source files
- Build a structured `RepoContext` object: { files, readme, manifest, language, structure summary }
- API route: `POST /api/analyze` — accepts repo URL, returns `RepoContext`
- Loading state in UI while fetching

**Verifiable output:**
- Pasting `https://github.com/vercel/next.js` (or any public repo) into the input and hitting enter returns a parsed `RepoContext` object visible in the console/network tab
- Files over token limit are gracefully truncated, not dropped silently
- Binary files and `node_modules` are excluded

---

### Phase 3 — AI Analysis Engine
**Goal:** AI reads the repo context and produces a project intelligence report used to fuel the interview.

**Tasks:**
- Prompt engineering: system prompt that instructs Claude to act as a senior engineer analyzing a codebase
- Generate `ProjectProfile`: { stack, architecture pattern, key modules, notable decisions, potential weak spots, interesting areas to probe }
- This profile is the "pre-interview brief" — not shown to the user, used internally by the interviewer
- Stream the analysis phase in the UI with a progress indicator ("Analyzing architecture...", "Reading dependencies...", etc.)

**Verifiable output:**
- Given a repo, the system produces a coherent `ProjectProfile` JSON object
- Profile correctly identifies the framework, language, and at least 3 notable architectural points
- Profile includes `probeAreas` — specific things to ask the candidate about

---

### Phase 4 — Interview Engine (Core)
**Goal:** Multi-turn AI interview session driven by the project profile. Hard questions, no mercy.

**Tasks:**
- Build the interviewer system prompt: senior engineer persona, no softballs, follow up on vague answers, probe depth, call out BS
- Interview flow: opening question → candidate answers → AI evaluates + follow-up OR next topic → repeat for N rounds
- Question categories: architecture, implementation choices, debugging scenarios, scaling, security, testing, conceptual depth
- Streaming responses for all AI turns
- Chat UI: interviewer messages on left, user input at bottom, clean terminal-like aesthetic
- Track turn count, current topic, answered vs dodged questions

**Verifiable output:**
- Start a session with any public repo — AI asks a first question that is clearly specific to that repo (not generic)
- Answer vaguely — AI pushes back and asks a follow-up rather than accepting it
- After 3-4 exchanges the AI moves to a new topic from the project profile
- All AI responses stream in real time

---

### Phase 5 — Post-Interview Debrief
**Goal:** After the session ends, deliver a brutally honest performance summary.

**Tasks:**
- Detect session end (user submits "done" / fixed turn limit / AI wraps up)
- AI generates debrief: { score (1-10 per category), strong areas, weak areas, specific questions you fumbled, recommended study topics }
- Debrief page with structured breakdown — not a wall of text
- Option to restart with same repo or paste a new one

**Verifiable output:**
- After completing an interview, a debrief page renders with per-category scores
- Debrief calls out at least one specific answer that was weak and explains why
- "Try Again" restarts the session with the same repo (re-uses cached `ProjectProfile`)

---

### Phase 6 — Polish + Production Readiness
**Goal:** Shippable product with good UX and no rough edges.

**Tasks:**
- Rate limiting on `/api/analyze` and interview turns (prevent abuse)
- Handle GitHub API rate limits gracefully (429 errors with user-facing message)
- Mobile-responsive layout
- SEO: meta tags, OG image for sharing
- Error boundaries on all async UI
- Deploy to Vercel, set env vars, smoke test on prod URL

**Verifiable output:**
- Deployed URL works end-to-end on mobile and desktop
- Hitting the API 20 times in quick succession returns a rate limit error, not a 500
- Sharing the URL on Twitter/Slack shows a proper OG preview card
