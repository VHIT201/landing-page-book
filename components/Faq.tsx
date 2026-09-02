"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { site } from "@/content/site";

export default function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section id="faq" className="bg-paper py-24">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <p className="eyebrow">Giải đáp</p>
        <h2 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
          {site.faqTitle}
        </h2>

        <dl className="mt-12 border-t border-line">
          {site.faq.map((f, i) => {
            const open = openIdx === i;
            return (
              <div key={f.q} className="border-b border-line">
                <dt>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenIdx(open ? null : i)}
                    className="group flex w-full items-center gap-5 py-6 text-left sm:gap-8"
                  >
                    <span className="font-display text-sm text-ink-faint tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 font-display text-xl font-medium text-ink transition-colors group-hover:text-brass sm:text-2xl">
                      {f.q}
                    </span>
                    <motion.span
                      aria-hidden
                      animate={{ rotate: open ? 45 : 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="shrink-0 text-2xl font-light text-brass"
                    >
                      +
                    </motion.span>
                  </button>
                </dt>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.dd
                      key="content"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-7 pl-9 pr-4 text-lg leading-relaxed text-ink-soft sm:pl-16">
                        {f.a}
                      </p>
                    </motion.dd>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
