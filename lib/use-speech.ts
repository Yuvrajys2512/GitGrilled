"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Subscribe helper for client-only flags: the value never changes after mount,
// so we never need to notify React of an update.
const noopSubscribe = () => () => {};

// ─── Minimal Web Speech API typings ──────────────────────────────────
// These aren't in the standard TS DOM lib, so we declare just what we use.
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { readonly transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ─── Speech-to-text (dictation) ──────────────────────────────────────
export function useDictation(onFinalChunk: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = typeof window !== "undefined" && getRecognitionCtor() !== null;
  // Keep the latest callback without re-creating the recognition instance.
  const cbRef = useRef(onFinalChunk);
  useEffect(() => {
    cbRef.current = onFinalChunk;
  }, [onFinalChunk]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    // Cancel any prior instance.
    recognitionRef.current?.abort();

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) cbRef.current(finalText);
      setInterim(interimText);
    };
    rec.onerror = () => {
      setListening(false);
      setInterim("");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { listening, interim, supported, start, stop };
}

// ─── Text-to-speech (interviewer voice) ──────────────────────────────
function pickInterviewerVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : voices;
  // Aim for a calm, refined British male voice (a Jarvis-like read) and fall
  // back to other natural male voices. British male first:
  //   Google UK English Male (Chrome/Edge), Microsoft Ryan/George (Win en-GB),
  //   Daniel/Arthur (macOS en-GB); then deeper en-US voices as a last resort.
  const preferred = [
    "Google UK English Male",
    "Microsoft Ryan",
    "Microsoft George",
    "Daniel",
    "Arthur",
    "Microsoft Guy",
    "Alex",
    "Microsoft David",
  ];
  for (const name of preferred) {
    const match = pool.find((v) => v.name.includes(name));
    if (match) return match;
  }
  // No named match — prefer any en-GB voice for the accent, else the first.
  const gb = pool.find((v) => v.lang.toLowerCase() === "en-gb");
  return gb ?? pool[0];
}

export function useSpeaker() {
  // Always "supported" on the client: we use the server TTS route and fall back
  // to the browser's speechSynthesis if it's unavailable or fails. Read it via
  // useSyncExternalStore so SSR renders false and the client renders true
  // without a hydration mismatch or a setState-in-effect.
  const supported = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  // Monotonic request id so a newer speak() supersedes any in-flight fetch.
  const reqId = useRef(0);
  const hasSynth = typeof window !== "undefined" && "speechSynthesis" in window;

  // Web Audio graph for the talking avatar: played TTS is routed through an
  // analyser so the avatar can lip-sync to real amplitude in real time.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const ensureGraph = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    }
  }, []);

  // Call from a user gesture (toggle/start) to satisfy autoplay policies.
  const unlockAudio = useCallback(() => {
    ensureGraph();
    if (audioCtxRef.current?.state === "suspended") {
      void audioCtxRef.current.resume();
    }
  }, [ensureGraph]);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  useEffect(() => {
    if (!hasSynth) return;
    const load = () => {
      voiceRef.current = pickInterviewerVoice(window.speechSynthesis.getVoices());
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [hasSynth]);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    reqId.current++; // invalidate any in-flight request
    cleanupAudio();
    if (hasSynth) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [cleanupAudio, hasSynth]);

  // Browser speechSynthesis fallback.
  const browserSpeak = useCallback(
    (text: string) => {
      if (!hasSynth) {
        setSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utter.voice = voiceRef.current;
      // Slightly slower + lower for a calm, measured, composed delivery.
      utter.rate = 0.95;
      utter.pitch = 0.9;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [hasSynth]
  );

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      cancel();
      const id = ++reqId.current;
      setSpeaking(true);

      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (id !== reqId.current) return; // superseded while fetching
        if (!res.ok) throw new Error("tts unavailable");

        const blob = await res.blob();
        if (id !== reqId.current) return;

        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;

        // Route through the analyser graph so the avatar can lip-sync. The blob
        // is same-origin (object URL), so the audio isn't tainted.
        ensureGraph();
        if (audioCtxRef.current && analyserRef.current) {
          if (audioCtxRef.current.state === "suspended") {
            void audioCtxRef.current.resume();
          }
          try {
            const srcNode = audioCtxRef.current.createMediaElementSource(audio);
            srcNode.connect(analyserRef.current);
          } catch {
            // If routing fails for any reason, the audio still plays normally.
          }
        }

        audio.onended = () => {
          if (id === reqId.current) setSpeaking(false);
          cleanupAudio();
        };
        audio.onerror = () => {
          if (id === reqId.current) browserSpeak(text);
        };
        await audio.play();
      } catch {
        if (id !== reqId.current) return;
        // Server TTS failed — fall back to the browser voice.
        browserSpeak(text);
      }
    },
    [cancel, cleanupAudio, browserSpeak, ensureGraph]
  );

  return { supported, speaking, speak, cancel, getAnalyser, unlockAudio };
}
