"use client";

import { useEffect, useRef, useState } from "react";
import { Video, VideoOff } from "lucide-react";

// The candidate's webcam, picture-in-picture, to sell the "video interview"
// feel. Degrades gracefully if the camera is denied or unavailable.
export function WebcamPip() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setError(true);
      }
    }

    function stop() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (on) start();
    else stop();

    return () => {
      cancelled = true;
      stop();
    };
  }, [on]);

  return (
    <div className="relative w-40 h-28 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
      {on && !error ? (
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover -scale-x-100"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-zinc-600 text-xs font-mono">
          {error ? "no camera" : "camera off"}
        </div>
      )}

      <button
        onClick={() => {
          setError(false);
          setOn((v) => !v);
        }}
        title={on ? "Turn camera off" : "Turn camera on"}
        className="absolute bottom-1 right-1 p-1 rounded bg-black/60 text-zinc-300 hover:text-white transition-colors"
      >
        {on && !error ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
      </button>

      <span className="absolute bottom-1 left-1.5 text-[10px] font-mono text-zinc-400">you</span>
    </div>
  );
}
