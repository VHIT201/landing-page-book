"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { site } from "@/content/site";
import Reveal from "./motion/Reveal";

const PER = 3;

export default function Reviews() {
  const reduce = useReducedMotion();
  const reviews = site.reviews;
  const pages = Math.ceil(reviews.length / PER);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused || pages < 2) return;
    const id = setInterval(() => setPage((p) => (p + 1) % pages), 5500);
    return () => clearInterval(id);
  }, [reduce, paused, pages]);

  const go = (d: number) => setPage((p) => (p + d + pages) % pages);

  return (
    <section id="cam-nhan" className="border-y border-line bg-cream py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Đồng hành</p>
            <h2 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
              {site.reviewsTitle}
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Cảm nhận trước"
              onClick={() => go(-1)}
              className="flex size-11 items-center justify-center rounded-full border border-line-strong text-lg text-ink transition-colors hover:bg-ink hover:text-white"
            >
              &larr;
            </button>
            <button
              type="button"
              aria-label="Cảm nhận sau"
              onClick={() => go(1)}
              className="flex size-11 items-center justify-center rounded-full border border-line-strong text-lg text-ink transition-colors hover:bg-ink hover:text-white"
            >
              &rarr;
            </button>
          </div>
        </Reveal>

        <div
          className="mt-12 overflow-hidden border-t-2 border-ink"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <motion.div
            className="flex"
            animate={{ x: `-${page * 100}%` }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
            }
          >
            {Array.from({ length: pages }).map((_, pi) => (
              <div
                key={pi}
                className="grid w-full shrink-0 gap-x-10 gap-y-12 pt-10 md:grid-cols-3"
              >
                {reviews.slice(pi * PER, pi * PER + PER).map((r, i) => (
                  <figure key={r.name} className="flex flex-col">
                    <span className="font-display text-sm text-ink-faint tabular-nums">
                      {String(pi * PER + i + 1).padStart(2, "0")}
                    </span>
                    <blockquote className="display-italic mt-3 flex-1 text-xl leading-snug text-ink text-pretty">
                      &ldquo;{r.text}&rdquo;
                    </blockquote>
                    <figcaption className="mt-6 border-t border-line pt-4">
                      <span className="block font-semibold text-ink">
                        {r.name}
                      </span>
                      <span className="block text-sm text-ink-faint">
                        {r.title}
                      </span>
                      <span
                        aria-label={`${r.stars} trên 5 sao`}
                        className="mt-1.5 block tracking-[0.15em] text-goldaccent"
                      >
                        {"★".repeat(r.stars)}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ))}
          </motion.div>
        </div>

        <div className="mt-9 flex justify-center gap-2">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Trang ${i + 1}`}
              aria-current={i === page}
              onClick={() => setPage(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === page
                  ? "w-8 bg-ink"
                  : "w-3 bg-line-strong hover:bg-ink-faint"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
