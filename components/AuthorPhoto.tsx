"use client";

import { useEffect, useRef, useState } from "react";

export default function AuthorPhoto({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-navy to-navy-deep">
      {!loaded && (
        <span className="absolute inset-0 flex items-center justify-center font-display text-6xl font-bold text-white/15">
          NCT
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        className={`size-full object-cover transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
