"use client";

import { useState } from "react";
import { site } from "@/content/site";

export default function BookCover({
  className = "",
  depth = 44,
  float = true,
}: {
  className?: string;
  /** độ dày gáy sách, px */
  depth?: number;
  float?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`book3d-scene ${className}`}>
      <div
        className="book3d aspect-[2/3] w-full"
        style={
          {
            "--book-depth": `${depth}px`,
            animationPlayState: float ? "running" : "paused",
          } as React.CSSProperties
        }
      >
        <div className="book3d__back" />
        <div className="book3d__spine" />
        <div className="book3d__pages" />
        <div className="book3d__face h-full w-full">
          {/* nền chờ bìa thật — thả /public{site.hero.coverImage} để thay thế */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-navy-600 to-navy-900 p-4 text-center">
            <span className="font-display text-lg font-bold tracking-tight text-white">
              THE LIFECAR
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              Chiếc xe cuộc đời
            </span>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={site.hero.coverImage}
            alt={site.hero.coverAlt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(false)}
            className={`relative h-full w-full object-cover transition-opacity duration-500 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
        <div className="book3d__shadow" />
      </div>
    </div>
  );
}
