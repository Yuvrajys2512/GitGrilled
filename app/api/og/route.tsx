import { ImageResponse } from "next/og";
import { verdictLabel } from "@/lib/scorecard";
import { loadScorecard } from "@/lib/load-scorecard";

export const runtime = "nodejs";

function scoreColor(score: number): string {
  if (score >= 7) return "#4ade80"; // green-400
  if (score >= 5) return "#facc15"; // yellow-400
  return "#f87171"; // red-400
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const card = await loadScorecard({
    id: searchParams.get("id") ?? undefined,
    d: searchParams.get("d") ?? undefined,
  });

  const owner = card?.owner ?? "unknown";
  const repo = card?.repo ?? "repo";
  const score = card?.score ?? 0;
  const verdict = card?.verdict ?? "";
  const categories = (card?.categories ?? []).slice(0, 4);
  const color = scoreColor(score);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#09090b",
          padding: "64px",
          fontFamily: "monospace",
          color: "#fafafa",
          justifyContent: "space-between",
        }}
      >
        {/* Top: brand + repo */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "28px", color: "#fbbf24", fontWeight: 700 }}>🔥 GitGrilled</div>
          </div>
          <div style={{ display: "flex", fontSize: "52px", fontWeight: 800, color: "#ffffff" }}>
            {`${owner}/${repo}`}
          </div>
          <div style={{ fontSize: "30px", color, fontWeight: 700 }}>
            {verdictLabel(score)}
          </div>
        </div>

        {/* Middle: verdict text */}
        {verdict && (
          <div
            style={{
              display: "flex",
              fontSize: "26px",
              color: "#a1a1aa",
              lineHeight: 1.45,
              maxWidth: "760px",
            }}
          >
            {verdict.length > 220 ? verdict.slice(0, 220) + "…" : verdict}
          </div>
        )}

        {/* Bottom: score + categories */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "620px" }}>
            {categories.map((c) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ display: "flex", width: "240px", fontSize: "22px", color: "#d4d4d8" }}>
                  {c.name.length > 22 ? c.name.slice(0, 22) + "…" : c.name}
                </div>
                <div style={{ display: "flex", width: "220px", height: "12px", backgroundColor: "#27272a", borderRadius: "6px" }}>
                  <div
                    style={{
                      display: "flex",
                      width: `${(c.score / 10) * 220}px`,
                      height: "12px",
                      backgroundColor: scoreColor(c.score),
                      borderRadius: "6px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", fontSize: "20px", color: "#71717a" }}>{c.score}/10</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: "150px", fontWeight: 900, color, lineHeight: 1 }}>
              {score}
            </div>
            <div style={{ display: "flex", fontSize: "30px", color: "#52525b" }}>/ 10</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
