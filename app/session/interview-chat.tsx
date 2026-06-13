"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { Mic, Volume2, VolumeX, Video, VideoOff } from "lucide-react";
import type { ProjectProfile } from "@/lib/profile";
import type { Debrief } from "@/lib/debrief";
import { debriefSchema } from "@/lib/debrief";
import { useDictation, useSpeaker } from "@/lib/use-speech";
import type { PersonaId } from "@/lib/personas";
import { DebriefView } from "./debrief-view";
import { MessageContent } from "./message-content";
import { Avatar } from "./avatar";
import { WebcamPip } from "./webcam-pip";

function formatClock(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface TraceStep {
  icon: string;
  label: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  // Live "reading your code" trace: the tool calls the interviewer made before
  // producing this message (assistant turns only).
  trace?: TraceStep[];
}

// Turn a raw interviewer tool call into a human-readable trace line.
function describeTool(name: string, input: unknown): TraceStep {
  const arg = (input ?? {}) as { path?: string; query?: string; prefix?: string };
  switch (name) {
    case "readFile":
      return { icon: "📄", label: `reading ${arg.path ?? "a file"}` };
    case "searchCode":
      return { icon: "🔍", label: `searching “${arg.query ?? ""}”` };
    case "listFiles":
      return { icon: "📂", label: arg.prefix ? `listing ${arg.prefix}/` : "listing files" };
    default:
      return { icon: "⚙️", label: name };
  }
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

// The live "reading your code" trace — each tool call the interviewer made,
// shown in order. The last line pulses while the agent is still working.
function TraceList({ steps, active }: { steps: TraceStep[]; active: boolean }) {
  return (
    <div className="flex flex-col gap-1 mb-2 border-l-2 border-zinc-800 pl-2.5">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <span
            key={i}
            className={`flex items-center gap-2 text-[11px] font-mono ${
              active && isLast ? "text-amber-400/90" : "text-zinc-500"
            }`}
          >
            <span className="shrink-0">{s.icon}</span>
            <span className="truncate">{s.label}</span>
            {active && isLast && (
              <span className="inline-flex gap-0.5 ml-0.5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1 h-1 rounded-full bg-amber-500/70 animate-bounce"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function cleanContent(text: string) {
  return text
    .replace("[INTERVIEW_COMPLETE]", "")
    .replace("[BUG_HUNT]", "")
    .replace("[HINT]", "")
    .trim();
}

// Graduated hint cost: cheap the first time, pricier each subsequent hint.
function hintCost(hintsAlreadyUsed: number): number {
  return [0.5, 1.0, 1.5][Math.min(hintsAlreadyUsed, 2)];
}

const BUG_HUNT_SECONDS = 60;

// A framed "find the bug" challenge: the interviewer's question with the cited
// code auto-expanded, plus a countdown that runs while the candidate answers.
function BugHuntCard({
  content,
  owner,
  repo,
  branch,
  live,
}: {
  content: string;
  owner: string;
  repo: string;
  branch: string;
  live: boolean;
}) {
  const [remaining, setRemaining] = useState(BUG_HUNT_SECONDS);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [live]);

  const danger = remaining <= 10;
  const clock = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, "0")}`;

  return (
    <div className="rounded-lg border border-amber-800/60 bg-amber-950/15 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-amber-900/50 bg-amber-950/40">
        <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-amber-300">
          🐛 Bug Hunt
        </span>
        {live && (
          <span
            className={`font-mono text-xs tabular-nums ${
              danger ? "text-red-400 animate-pulse" : "text-amber-300"
            }`}
          >
            {remaining === 0 ? "⏱ time's up" : `⏱ ${clock}`}
          </span>
        )}
      </div>
      <div className="px-4 py-3 text-sm leading-relaxed text-zinc-200">
        <MessageContent text={content} owner={owner} repo={repo} branch={branch} autoExpand />
      </div>
    </div>
  );
}

interface Props {
  profile: ProjectProfile;
  owner: string;
  repo: string;
  branch: string;
  fileTree: string;
  persona: PersonaId;
}

export function InterviewChat({ profile, owner, repo, branch, fileTree, persona }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const [debrief, setDebrief] = useState<Partial<Debrief> | null>(null);
  const [debriefStreaming, setDebriefStreaming] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Live score economy: starts at 10, each hint costs a graduated penalty.
  const [score, setScore] = useState(10);
  const [hintsUsed, setHintsUsed] = useState(0);
  const hintsRef = useRef(0);
  useEffect(() => {
    hintsRef.current = hintsUsed;
  }, [hintsUsed]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);
  const debriefStarted = useRef(false);
  const voiceModeRef = useRef(false);
  const videoModeRef = useRef(false);
  useEffect(() => {
    voiceModeRef.current = voiceMode;
    videoModeRef.current = videoMode;
  }, [voiceMode, videoMode]);

  // Speech-to-text: dictate answers straight into the input.
  const dictation = useDictation((chunk) => {
    setInput((prev) => (prev ? prev.trimEnd() + " " : "") + chunk.trim());
  });
  // Text-to-speech: the interviewer reads each question aloud in voice mode.
  const speaker = useSpeaker();

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Re-focus after AI responds
  useEffect(() => {
    if (!isStreaming && !interviewDone && messages.length > 0) {
      inputRef.current?.focus();
    }
  }, [isStreaming, interviewDone, messages.length]);

  function updateLastAssistant(patch: Partial<ChatMessage>) {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = { ...last, ...patch };
      return updated;
    });
  }

  function setLastAssistant(content: string) {
    updateLastAssistant({ content });
  }

  async function sendMessage(userContent: string) {
    // Stop dictation and any in-flight speech the moment an answer is sent.
    if (dictation.listening) dictation.stop();
    speaker.cancel();

    const outgoing: ChatMessage[] = [
      ...messages,
      { role: "user", content: userContent },
    ];
    setMessages(outgoing);
    setInput("");
    setIsStreaming(true);
    // Seed assistant message
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      // Groq occasionally returns an empty stream for a tool turn ("Failed to
      // call a function"). It's intermittent, so retry once before giving up.
      await streamAssistant(outgoing, 0);
    } finally {
      setIsStreaming(false);
    }
  }

  async function streamAssistant(outgoing: ChatMessage[], attempt: number) {
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: outgoing.map((m) => ({ role: m.role, content: m.content })),
          profile,
          owner,
          repo,
          branch,
          fileTree,
          persona,
        }),
      });

      if (!res.ok || !res.body) {
        setLastAssistant(
          res.status === 429
            ? "You're going too fast — wait a moment before sending again."
            : "Something went wrong. Try again."
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      const trace: TraceStep[] = [];

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let evt: { t: string; name?: string; input?: unknown; v?: string };
        try {
          evt = JSON.parse(trimmed);
        } catch {
          return;
        }
        if (evt.t === "tool" && evt.name) {
          trace.push(describeTool(evt.name, evt.input));
          updateLastAssistant({ trace: [...trace] });
        } else if (evt.t === "text" && evt.v) {
          full += evt.v;
          updateLastAssistant({ content: full });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          handleLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
      if (buffer.trim()) handleLine(buffer);

      // Empty stream → intermittent upstream hiccup. Retry once silently.
      if (!full.trim()) {
        if (attempt < 1) {
          await new Promise((r) => setTimeout(r, 500));
          return streamAssistant(outgoing, attempt + 1);
        }
        setLastAssistant(
          "⚠️ The interviewer didn't respond. This can happen if the Groq daily token limit is hit — try again in a moment."
        );
        return;
      }

      // In voice or video mode, read the interviewer's question aloud once done.
      if (voiceModeRef.current || videoModeRef.current) {
        const spoken = cleanContent(full);
        if (spoken) speaker.speak(spoken);
      }

      if (full.includes("[INTERVIEW_COMPLETE]")) {
        setInterviewDone(true);
      }
    } catch {
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 500));
        return streamAssistant(outgoing, attempt + 1);
      }
      setLastAssistant("Network error. Check your connection.");
    }
  }

  async function generateDebrief(finalMessages: ChatMessage[]) {
    if (debriefStarted.current) return;
    debriefStarted.current = true;
    setDebriefStreaming(true);
    setDebrief({});

    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, conversation: finalMessages, hintsUsed: hintsRef.current }),
      });

      if (!res.ok) return;

      // The route returns a schema-validated Debrief as plain JSON.
      const parsed = debriefSchema.safeParse(await res.json());
      if (parsed.success) setDebrief(parsed.data);
    } finally {
      setDebriefStreaming(false);
    }
  }

  // Trigger debrief once interview is done
  useEffect(() => {
    if (interviewDone && messages.length > 0) {
      generateDebrief(messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewDone]);

  // Kick off first question
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      sendMessage("__BEGIN__");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (input.trim() && !isStreaming && !interviewDone) {
      sendMessage(input.trim());
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming && !interviewDone) {
        sendMessage(input.trim());
      }
    }
  }

  function toggleVoiceMode() {
    setVoiceMode((on) => {
      if (on) speaker.cancel(); // turning off — silence any current speech
      else speaker.unlockAudio(); // gesture — satisfy autoplay policy
      return !on;
    });
  }

  function toggleMic() {
    if (dictation.listening) dictation.stop();
    else dictation.start();
  }

  // Spend points for a graduated hint on the current question.
  function requestHint() {
    if (isStreaming || interviewDone) return;
    const last = [...messages]
      .reverse()
      .find((m) => m.content !== "__BEGIN__" && m.content !== "__HINT__");
    if (!last || last.role !== "assistant") return; // nothing to hint on yet
    const cost = hintCost(hintsUsed);
    setScore((s) => Math.max(0, Math.round((s - cost) * 10) / 10));
    setHintsUsed((n) => n + 1);
    sendMessage("__HINT__");
  }

  function toggleVideoMode() {
    setVideoMode((on) => {
      const next = !on;
      if (next) {
        speaker.unlockAudio(); // gesture — satisfy autoplay policy
        // Speak the current question immediately on entering video mode.
        const lastA = [...messages].reverse().find((m) => m.role === "assistant");
        const q = lastA && cleanContent(lastA.content);
        if (q) speaker.speak(q);
      } else {
        speaker.cancel();
      }
      return next;
    });
  }

  // Interview clock (counts up while in video mode).
  useEffect(() => {
    if (!videoMode) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [videoMode]);

  const isSentinel = (c: string) => c === "__BEGIN__" || c === "__HINT__";
  const visibleMessages = messages.filter((m) => !isSentinel(m.content));
  const userCount = messages.filter(
    (m) => m.role === "user" && !isSentinel(m.content)
  ).length;
  const lastRole = visibleMessages[visibleMessages.length - 1]?.role;
  const showTyping = isStreaming && lastRole === "user";
  const lastAssistant = [...visibleMessages].reverse().find((m) => m.role === "assistant");
  const currentQuestion = lastAssistant ? cleanContent(lastAssistant.content) : "";
  // The candidate is mid bug-hunt when the latest message is an unanswered
  // [BUG_HUNT] challenge — used to reframe the input as a diagnosis submission.
  const awaitingBugHunt =
    !isStreaming &&
    !interviewDone &&
    visibleMessages[visibleMessages.length - 1]?.role === "assistant" &&
    !!visibleMessages[visibleMessages.length - 1]?.content.includes("[BUG_HUNT]");
  // A hint can be requested whenever there's an unanswered interviewer question.
  const canHint =
    !isStreaming &&
    !interviewDone &&
    visibleMessages[visibleMessages.length - 1]?.role === "assistant";
  const nextHintCost = hintCost(hintsUsed);

  return (
    <div className="flex flex-1 flex-col max-w-3xl mx-auto w-full min-h-0">

      {/* Status bar */}
      <div className="flex items-center justify-between py-2 border-b border-zinc-900 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-600">
            {interviewDone ? (
              <span className="text-zinc-400">Interview complete</span>
            ) : isStreaming && lastRole === "user" ? (
              <span className="text-amber-600/70">Interviewer thinking...</span>
            ) : (
              <span>Exchange {userCount}</span>
            )}
          </span>
          <span
            title={hintsUsed > 0 ? `${hintsUsed} hint${hintsUsed === 1 ? "" : "s"} used` : "Full marks — no hints yet"}
            className={`font-mono text-xs tabular-nums px-1.5 py-0.5 rounded border transition-colors ${
              score >= 7
                ? "text-green-400 border-green-900/50 bg-green-950/20"
                : score >= 5
                  ? "text-yellow-400 border-yellow-900/50 bg-yellow-950/20"
                  : "text-red-400 border-red-900/50 bg-red-950/20"
            }`}
          >
            {score.toFixed(1)} pts
          </span>
        </div>
        <div className="flex items-center gap-3">
          {speaker.supported && (
            <button
              onClick={toggleVoiceMode}
              title={voiceMode ? "Voice mode on — click to mute" : "Read questions aloud"}
              className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border transition-colors ${
                voiceMode
                  ? "text-amber-400 border-amber-800/60 bg-amber-950/30"
                  : "text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {voiceMode ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              <span className="hidden sm:inline">{speaker.speaking ? "speaking…" : "voice"}</span>
            </button>
          )}
          {!interviewDone && (
            <button
              onClick={toggleVideoMode}
              title={videoMode ? "Exit video interview" : "Start video interview"}
              className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border transition-colors ${
                videoMode
                  ? "text-amber-400 border-amber-800/60 bg-amber-950/30"
                  : "text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {videoMode ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
              <span className="hidden sm:inline">video</span>
            </button>
          )}
          <span className="text-xs font-mono text-zinc-700">{owner}/{repo}</span>
        </div>
      </div>

      {/* Video interview stage */}
      {videoMode && !interviewDone ? (
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              REC <span className="text-zinc-600">{formatClock(elapsed)}</span>
            </span>
            <span className="text-xs font-mono text-zinc-600">Exchange {userCount}</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0 overflow-y-auto py-4">
            <Avatar
              getAnalyser={speaker.getAnalyser}
              speaking={speaker.speaking}
              thinking={isStreaming && !speaker.speaking}
              personaId={persona}
            />
            <div className="max-w-xl text-center min-h-[3rem] px-4">
              {currentQuestion ? (
                <p className="text-zinc-200 text-base leading-relaxed">{currentQuestion}</p>
              ) : (
                <p className="text-zinc-600 text-sm font-mono">connecting…</p>
              )}
            </div>
          </div>

          <div className="absolute bottom-3 right-3">
            <WebcamPip />
          </div>
        </div>
      ) : (
      /* Messages */
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">

        {messages.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <TypingDots />
          </div>
        )}

        {visibleMessages.map((msg, i) => {
          const isUser = msg.role === "user";
          const content = cleanContent(msg.content);
          const isBugHunt = !isUser && msg.content.includes("[BUG_HUNT]");
          const isHint = !isUser && msg.content.includes("[HINT]");
          const isStreamingThis = i === visibleMessages.length - 1 && isStreaming;
          const bugHuntLive =
            isBugHunt && !!content && !isStreamingThis &&
            i === visibleMessages.length - 1 && !interviewDone;

          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                <span className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono uppercase tracking-widest ${isUser ? "text-zinc-600" : "text-amber-600/80"}`}>
                    {isUser ? "you" : "interviewer"}
                  </span>
                  {isHint && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-sky-300 bg-sky-950/40 border border-sky-800/60 rounded px-1.5 py-0.5">
                      💡 Hint
                    </span>
                  )}
                </span>
                {isBugHunt && content ? (
                  <>
                    {msg.trace && msg.trace.length > 0 && (
                      <TraceList steps={msg.trace} active={false} />
                    )}
                    <BugHuntCard
                      content={content}
                      owner={owner}
                      repo={repo}
                      branch={branch}
                      live={bugHuntLive}
                    />
                  </>
                ) : (
                  <div className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? "bg-zinc-800 text-zinc-100 whitespace-pre-wrap"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-200"
                  }`}>
                    {!isUser && msg.trace && msg.trace.length > 0 && (
                      <TraceList steps={msg.trace} active={isStreamingThis && !content} />
                    )}
                    {content ? (
                      isUser ? (
                        content
                      ) : (
                        <MessageContent text={content} owner={owner} repo={repo} branch={branch} />
                      )
                    ) : !isUser && msg.trace && msg.trace.length > 0 ? null : isStreamingThis ? (
                      <TypingDots />
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {showTyping && (
          <div className="flex justify-start">
            <div className="flex flex-col gap-1 items-start">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-600/80">interviewer</span>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                <TypingDots />
              </div>
            </div>
          </div>
        )}

        {interviewDone && debrief !== null && (
          <DebriefView
            debrief={debrief}
            isStreaming={debriefStreaming}
            owner={owner}
            repo={repo}
          />
        )}

        {interviewDone && debrief === null && (
          <div className="flex items-center gap-2 py-4 text-zinc-600 text-xs font-mono">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
            <span>Generating your debrief...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
      )}

      {/* Input */}
      {!interviewDone && (
        <div className="border-t border-zinc-900 pt-4 pb-2 shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isStreaming
                    ? "Wait for the question..."
                    : dictation.listening
                      ? "Listening — speak your answer…"
                      : awaitingBugHunt
                        ? "Diagnose the bug — what's wrong and why?"
                        : "Your answer — be specific, no hand-waving"
                }
                disabled={isStreaming}
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 pr-12 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-none disabled:opacity-40 font-mono leading-relaxed"
              />
              {dictation.supported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={isStreaming}
                  title={dictation.listening ? "Stop dictation" : "Dictate your answer"}
                  className={`absolute top-2.5 right-2.5 p-1.5 rounded-md border transition-colors disabled:opacity-30 ${
                    dictation.listening
                      ? "text-red-400 border-red-800/60 bg-red-950/40 animate-pulse"
                      : "text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              )}
              {dictation.interim && (
                <span className="absolute bottom-2 left-4 right-12 text-xs text-zinc-600 italic truncate font-mono pointer-events-none">
                  {dictation.interim}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={requestHint}
              disabled={!canHint}
              title={canHint ? `Get a hint (costs ${nextHintCost.toFixed(1)} pts)` : "No question to hint on yet"}
              className="flex items-center gap-1.5 border border-sky-800/50 text-sky-300 px-3 py-2.5 rounded text-sm font-medium shrink-0 hover:border-sky-600 hover:bg-sky-950/30 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              💡 <span className="hidden sm:inline">Hint</span>
              <span className="font-mono text-xs text-sky-400/80">−{nextHintCost.toFixed(1)}</span>
            </button>
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="bg-white text-black px-4 py-2.5 rounded text-sm font-semibold shrink-0 hover:bg-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              {awaitingBugHunt ? "Submit diagnosis →" : "Send →"}
            </button>
          </form>
          <p className="text-zinc-700 text-xs mt-2 font-mono">
            Enter to send · Shift+Enter for newline
            {dictation.supported && " · 🎙 to dictate"}
          </p>
        </div>
      )}

    </div>
  );
}
