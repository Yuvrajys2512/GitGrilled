import { ImageResponse } from "next/og";

// Generated favicon — a branded "G" mark in GitGrilled's flame-orange on a
// near-black rounded tile. Replaces the default Next.js scaffold favicon.ico.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c0a09",
          borderRadius: "7px",
          color: "#fb923c",
          fontSize: "24px",
          fontWeight: 900,
          fontFamily: "monospace",
        }}
      >
        G
      </div>
    ),
    { ...size }
  );
}
