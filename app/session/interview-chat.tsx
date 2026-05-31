"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import type { ProjectProfile } from "@/lib/profile";
import type { Debrief } from "@/lib/debrief";
import { debriefSchema } from "@/lib/debrief";
import { DebriefView } from "./debrief-view";

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
}

export function InterviewChat({ profile, owner, repo, branch, fileTree }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const [debrief, setDebrief] = useState<Partial<Debrief> | null>(null);
  const [debriefStreaming, setDebriefStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);
  const debriefStarted = useRef(false);

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
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Something went wrong. Try again.",
          };
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

      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        // Attempt partial parse of the streaming JSON object
        try {
          const parsed = debriefSchema.partial().safeParse(JSON.parse(raw));
          if (parsed.success) setDebrief(parsed.data);
        } catch {
          // Not valid JSON yet — keep accumulating
        }
      }

      // Final parse — strip markdown fences the model sometimes adds
      try {
        const cleaned = raw.trim()
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "")
          .trim();
        const final = debriefSchema.safeParse(JSON.parse(cleaned));
        if (final.success) setDebrief(final.data);
      } catch {
        // Leave partial debrief visible
      }
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
        <span className="text-xs font-mono text-zinc-700">{owner}/{repo}</span>
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
                <div className={`rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-zinc-800 text-zinc-100"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-200"
                }`}>
                  {content || (
                    i === visibleMessages.length - 1 && isStreaming
                      ? <TypingDots />
                      : null
                  )}
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
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isStreaming
                  ? "Wait for the question..."
                  : "Your answer — be specific, no hand-waving"
              }
              disabled={isStreaming}
              rows={3}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-none disabled:opacity-40 font-mono leading-relaxed"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="bg-white text-black px-4 py-2.5 rounded text-sm font-semibold shrink-0 hover:bg-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              Send →
            </button>
          </form>
          <p className="text-zinc-700 text-xs mt-2 font-mono">Enter to send · Shift+Enter for newline</p>
        </div>
      )}

    </div>
  );
}
