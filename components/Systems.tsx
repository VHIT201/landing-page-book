"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { site } from "@/content/site";
import Reveal from "./motion/Reveal";

export default function Systems() {
  const reduce = useReducedMotion();

  return (
    <section id="he-thong" className="border-y border-line bg-cream py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-end md:gap-8">
          <Reveal>
            <p className="eyebrow">Nội dung sách</p>
            <h2 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">
              {site.systemsTitle}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-md text-lg leading-relaxed text-ink-soft md:text-right">
              {site.systemsLead}
            </p>
          </Reveal>
        </div>

        <div className="mt-14 max-w-4xl sm:mt-20">
          {site.systems.map((s, i) => (
            <SystemRow key={s.code} s={s} i={i} reduce={!!reduce} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SystemRow({
  s,
  i,
  reduce,
}: {
  s: { code: string; name: string; desc: string };
  i: number;
  reduce: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useInView(ref, { margin: "-45% 0px -45% 0px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.55, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }
      }
      className="group grid grid-cols-[3rem_1fr] items-baseline gap-x-5 gap-y-2 border-t border-line py-7 last:border-b sm:grid-cols-[4.5rem_12rem_1fr] sm:gap-x-8 sm:py-9"
    >
      {/* số — cột trái, cỡ lớn */}
      <span
        className={`row-span-2 self-start font-display text-3xl font-bold leading-none tabular-nums transition-colors duration-500 sm:row-span-1 sm:text-4xl ${
          active ? "text-brass" : "text-line-strong"
        }`}
      >
        {String(i + 1).padStart(2, "0")}
      </span>

      {/* mã hệ thống */}
      <h3
        className={`font-display text-2xl transition-[color,transform] duration-500 group-hover:text-brass sm:text-4xl ${
          active ? "text-brass sm:translate-x-1" : "text-ink"
        }`}
      >
        {s.code}
      </h3>

      {/* tên + mô tả */}
      <div className="col-start-2 sm:col-start-3">
        <p
          className={`font-semibold transition-colors duration-500 ${
            active ? "text-ink" : "text-ink-soft"
          }`}
        >
          {s.name}
        </p>
        <p className="mt-1 leading-relaxed text-ink-soft">{s.desc}</p>
      </div>
    </motion.div>
  );
}
