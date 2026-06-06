"use client";

import { useEffect, useRef, useState } from "react";
import { getPersona, type PersonaId } from "@/lib/personas";

const ACCENT: Record<PersonaId, string> = {
  staff: "#38bdf8", // sky
  cto: "#fb923c", // orange
  friendly: "#4ade80", // green
};

interface Props {
  getAnalyser: () => AnalyserNode | null;
  speaking: boolean;
  thinking: boolean;
  personaId: PersonaId;
}

// A stylized AI interviewer face that lip-syncs to the TTS audio in real time
// (via the shared Web Audio analyser) and blinks on an idle timer.
export function Avatar({ getAnalyser, speaking, thinking, personaId }: Props) {
  const persona = getPersona(personaId);
  const accent = ACCENT[personaId] ?? "#38bdf8";

  const mouthRef = useRef<SVGEllipseElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  const [blink, setBlink] = useState(false);

  // Lip-sync loop: sample audio amplitude (or synthesize when no analyser).
  useEffect(() => {
    let raf = 0;
    let cur = 0;
    const t0 = performance.now();
    let buf: Uint8Array<ArrayBuffer> | null = null;

    const tick = (now: number) => {
      let target = 0;
      const analyser = getAnalyser();
      if (speakingRef.current && analyser) {
        if (!buf || buf.length !== analyser.fftSize) buf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const d = (buf[i] - 128) / 128;
          sum += d * d;
        }
        target = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
      } else if (speakingRef.current) {
        // Browser-TTS fallback: no analyser, so fake a mouth-like motion.
        const s = (now - t0) / 1000;
        target = Math.max(0, (Math.sin(s * 17) * 0.5 + 0.5) * (0.45 + 0.55 * Math.abs(Math.sin(s * 5.3))));
      }
      cur += (target - cur) * 0.4;
      if (mouthRef.current) mouthRef.current.setAttribute("ry", String(2 + cur * 15));
      if (glowRef.current) glowRef.current.style.opacity = String(0.2 + cur * 0.55);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getAnalyser]);

  // Idle blinking.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        schedule();
      }, 2200 + Math.random() * 2800);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative flex flex-col items-center gap-4">
      {/* Glow that pulses with speech */}
      <div
        ref={glowRef}
        className="absolute top-0 w-48 h-48 rounded-full blur-2xl pointer-events-none"
        style={{ backgroundColor: accent, opacity: 0.2 }}
      />

      <div
        className="relative rounded-3xl border bg-zinc-950/80 p-6 transition-colors"
        style={{ borderColor: speaking ? accent : "#27272a" }}
      >
        <svg width="160" height="160" viewBox="0 0 160 160" className="relative">
          {/* Head */}
          <rect x="20" y="20" width="120" height="120" rx="32" fill="#0a0a0a" stroke="#1f1f22" strokeWidth="2" />

          {/* Eyes */}
          <g fill={accent}>
            <ellipse cx="60" cy="74" rx="9" ry={blink ? 1 : 11} />
            <ellipse cx="100" cy="74" rx="9" ry={blink ? 1 : 11} />
          </g>

          {/* Mouth — ry is animated by the lip-sync loop */}
          <ellipse ref={mouthRef} cx="80" cy="108" rx="22" ry="2" fill={accent} opacity="0.9" />

          {/* Thinking indicator: three dots near the mouth */}
          {thinking &&
            [0, 1, 2].map((i) => (
              <circle key={i} cx={66 + i * 14} cy="108" r="3" fill={accent}>
                <animate
                  attributeName="opacity"
                  values="0.2;1;0.2"
                  dur="1s"
                  begin={`${i * 0.15}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
        </svg>
      </div>

      <div className="text-center">
        <p className="text-zinc-200 text-sm font-medium">
          {persona.emoji} {persona.name}
        </p>
        <p className="text-zinc-600 text-xs font-mono mt-0.5">
          {thinking ? "thinking…" : speaking ? "speaking…" : "listening"}
        </p>
      </div>
    </div>
  );
}
