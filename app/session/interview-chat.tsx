"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { Mic, Volume2, VolumeX } from "lucide-react";
import type { ProjectProfile } from "@/lib/profile";
import type { Debrief } from "@/lib/debrief";
import { debriefSchema } from "@/lib/debrief";
import { useDictation, useSpeaker } from "@/lib/use-speech";
import type { PersonaId } from "@/lib/personas";
import { DebriefView } from "./debrief-view";
import { MessageContent } from "./message-content";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

function cleanContent(text: string) {
  return text.replace("[INTERVIEW_COMPLETE]", "").trim();
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);
  const debriefStarted = useRef(false);
  const voiceModeRef = useRef(false);
  voiceModeRef.current = voiceMode;

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
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only send role + content — ModelMessage shape
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
        const msg =
          res.status === 429
            ? "You're going too fast — wait a moment before sending again."
            : "Something went wrong. Try again.";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: msg };
          return updated;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const display = full;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: display };
          return updated;
        });
      }

      // In voice mode, read the interviewer's question aloud once it's complete.
      if (voiceModeRef.current) {
        const spoken = cleanContent(full);
        if (spoken) speaker.speak(spoken);
      }

      if (full.includes("[INTERVIEW_COMPLETE]")) {
        setInterviewDone(true);
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Network error. Check your connection.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
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
        body: JSON.stringify({ profile, conversation: finalMessages }),
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
      return !on;
    });
  }

  function toggleMic() {
    if (dictation.listening) dictation.stop();
    else dictation.start();
  }

  const visibleMessages = messages.filter((m) => m.content !== "__BEGIN__");
  const userCount = messages.filter(
    (m) => m.role === "user" && m.content !== "__BEGIN__"
  ).length;
  const lastRole = visibleMessages[visibleMessages.length - 1]?.role;
  const showTyping = isStreaming && lastRole === "user";

  return (
    <div className="flex flex-1 flex-col max-w-3xl mx-auto w-full min-h-0">

      {/* Status bar */}
      <div className="flex items-center justify-between py-2 border-b border-zinc-900 mb-4 shrink-0">
        <span className="text-xs font-mono text-zinc-600">
          {interviewDone ? (
            <span className="text-zinc-400">Interview complete</span>
          ) : isStreaming && lastRole === "user" ? (
            <span className="text-amber-600/70">Interviewer thinking...</span>
          ) : (
            <span>Exchange {userCount}</span>
          )}
        </span>
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
          <span className="text-xs font-mono text-zinc-700">{owner}/{repo}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">

        {messages.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <TypingDots />
          </div>
        )}

        {visibleMessages.map((msg, i) => {
          const isUser = msg.role === "user";
          const content = cleanContent(msg.content);

          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                <span className={`text-[10px] font-mono uppercase tracking-widest ${isUser ? "text-zinc-600" : "text-amber-600/80"}`}>
                  {isUser ? "you" : "interviewer"}
                </span>
                <div className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-zinc-800 text-zinc-100 whitespace-pre-wrap"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-200"
                }`}>
                  {content ? (
                    isUser ? (
                      content
                    ) : (
                      <MessageContent text={content} owner={owner} repo={repo} branch={branch} />
                    )
                  ) : i === visibleMessages.length - 1 && isStreaming ? (
                    <TypingDots />
                  ) : null}
                </div>
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
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="bg-white text-black px-4 py-2.5 rounded text-sm font-semibold shrink-0 hover:bg-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              Send →
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
