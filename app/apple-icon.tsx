import { ImageResponse } from "next/og";

// Home-screen icon for iOS. Same brand mark as the favicon, scaled up.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          color: "#fb923c",
          fontSize: "120px",
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
