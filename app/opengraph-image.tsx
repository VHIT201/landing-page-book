import { ImageResponse } from "next/og";
import { site } from "@/content/site";

export const runtime = "edge";
export const alt = site.meta.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1f2332",
          color: "#fff",
          padding: "72px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            color: "#79a9d0",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <span>00</span>
          <span style={{ color: "#9a9a9a" }}>{site.brand.tagline}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 118,
              fontWeight: 700,
              lineHeight: 0.95,
            }}
          >
            <span>THE&nbsp;</span>
            <span style={{ fontStyle: "italic" }}>LIFECAR</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#c9c9c3", marginTop: 20 }}>
            {site.hero.subtitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "2px solid rgba(255,255,255,0.2)",
            paddingTop: 24,
            fontSize: 22,
            color: "#9a9a9a",
          }}
        >
          <span>{site.author.publisher}</span>
          <span style={{ color: "#d9c08d", fontWeight: 700 }}>
            {site.finalCta.price}
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
