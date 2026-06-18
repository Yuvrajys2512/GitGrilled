// Structured logging. Emits one JSON object per line so Vercel's log drain (and
// any downstream service like Sentry/Logtail) can parse fields instead of
// scraping free-form `console.log` strings. Falls back to plain console in dev
// where JSON lines are noisy — set LOG_PRETTY=1 locally if you prefer.
//
// Use these at real failure points (GitHub 403/404/429, Groq errors, Upstash
// outages) so production failures surface as queryable events, not silent 500s.

type Level = "info" | "warn" | "error";

type Fields = Record<string, unknown>;

const pretty = process.env.LOG_PRETTY === "1";

function emit(level: Level, event: string, fields: Fields = {}) {
  if (pretty) {
    const detail = Object.keys(fields).length ? " " + JSON.stringify(fields) : "";
    const line = `[${level}] ${event}${detail}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const record = { level, event, time: new Date().toISOString(), ...fields };
  const line = JSON.stringify(record);
  // Route errors/warns to stderr so they're distinguishable in any aggregator.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Normalize anything thrown into a short, loggable string. */
export function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export const log = {
  info: (event: string, fields?: Fields) => emit("info", event, fields),
  warn: (event: string, fields?: Fields) => emit("warn", event, fields),
  error: (event: string, fields?: Fields) => emit("error", event, fields),
};
