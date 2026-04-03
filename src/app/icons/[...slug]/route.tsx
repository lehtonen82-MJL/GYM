import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const filename = slug.join("/");
  const size = filename.includes("512") ? 512 : 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size * 0.22,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: size * 0.04,
          }}
        >
          {/* Dumbbell bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
            }}
          >
            {/* Left plate */}
            <div
              style={{
                width: size * 0.09,
                height: size * 0.32,
                background: "#22c55e",
                borderRadius: size * 0.02,
              }}
            />
            {/* Left collar */}
            <div
              style={{
                width: size * 0.05,
                height: size * 0.18,
                background: "#16a34a",
                borderRadius: size * 0.01,
              }}
            />
            {/* Bar */}
            <div
              style={{
                width: size * 0.32,
                height: size * 0.06,
                background: "#4b5563",
                borderRadius: size * 0.01,
              }}
            />
            {/* Right collar */}
            <div
              style={{
                width: size * 0.05,
                height: size * 0.18,
                background: "#16a34a",
                borderRadius: size * 0.01,
              }}
            />
            {/* Right plate */}
            <div
              style={{
                width: size * 0.09,
                height: size * 0.32,
                background: "#22c55e",
                borderRadius: size * 0.02,
              }}
            />
          </div>
          {/* Text */}
          <div
            style={{
              color: "#22c55e",
              fontSize: size * 0.14,
              fontWeight: 800,
              letterSpacing: size * 0.01,
              fontFamily: "sans-serif",
              marginTop: size * 0.04,
            }}
          >
            GYM
          </div>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
