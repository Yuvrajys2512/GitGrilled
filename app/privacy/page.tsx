import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy & Disclaimer — GitGrilled",
  description: "What GitGrilled sends, stores, and what never leaves your browser.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16">
      <article className="mx-auto max-w-2xl text-zinc-300">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-white">Privacy &amp; Disclaimer</h1>
        <p className="mt-2 text-sm text-zinc-500">
          GitGrilled is a side project. Here&apos;s exactly what happens to your data.
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold text-white">What gets sent to the AI</h2>
          <p className="leading-relaxed">
            When you analyze a repo, GitGrilled fetches its <strong>public</strong> source
            files from GitHub and sends excerpts to a third-party LLM provider (Groq) to
            generate the interview, questions, and scorecard. Only public repositories are
            supported — nothing private is accessed. Your typed answers during the interview
            are also sent to the model to score them.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold text-white">What gets stored</h2>
          <p className="leading-relaxed">
            If you choose to share a scorecard, that scorecard (repo name, scores, and the
            generated verdict/roast) is stored for up to 30 days behind a short link so the
            page can be opened later. Repo analysis is cached briefly to speed up repeat
            runs. There are no user accounts and we don&apos;t store your interview
            transcript beyond the active session.
          </p>
          <p className="leading-relaxed">
            We use Vercel&apos;s privacy-friendly, cookieless analytics to count page
            views and aggregate performance — no personal data, no cross-site
            tracking, and nothing that identifies you individually.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold text-white">Camera &amp; microphone</h2>
          <p className="leading-relaxed">
            Voice mode and the video-avatar mode use your browser&apos;s built-in speech APIs.
            Your camera and microphone streams stay in your browser and are{" "}
            <strong>never uploaded</strong> — no video or audio is sent to our servers or to
            the AI provider. You can decline the permission prompt and still use the typed
            interview.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold text-white">Disclaimer</h2>
          <p className="leading-relaxed">
            All analysis, questions, scores, and roasts are <strong>AI-generated and may be
            wrong</strong>. Treat them as a practice aid, not authoritative feedback on your
            code or your ability. Don&apos;t make decisions based on them without your own
            judgment.
          </p>
        </section>
      </article>
    </main>
  );
}
