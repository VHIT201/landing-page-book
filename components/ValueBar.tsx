"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { site } from "@/content/site";
import Reveal from "./motion/Reveal";

export default function ValueBar() {
  const [active, setActive] = useState(0);

  return (
    <section
      id="gioi-thieu"
      className="relative isolate flex min-h-[85vh] items-center overflow-hidden bg-navy py-28 text-white"
    >
      {/* nền section — đổi theo bước active */}
      {site.valueBar.map((v, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={v.image}
          src={v.image}
          alt=""
          aria-hidden
          className={`absolute inset-0 -z-10 size-full object-cover transition-all duration-[900ms] ease-out ${
            active === i ? "scale-105 opacity-100" : "scale-100 opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-deep via-navy-deep/75 to-navy-deep/55" />

      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <Reveal>
          <p className="display-italic max-w-3xl border-l-2 border-brass-bright pl-6 text-3xl leading-tight text-white text-balance sm:text-4xl">
            {site.valueBarLead}
          </p>
        </Reveal>

        <div className="mt-20 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {site.valueBar.map((v, i) => (
            <Step
              key={v.title}
              idx={i}
              title={v.title}
              desc={v.desc}
              active={active === i}
              onActivate={() => setActive(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Step({
  idx,
  title,
  desc,
  active,
  onActivate,
}: {
  idx: number;
  title: string;
  desc: string;
  active: boolean;
  onActivate: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActivate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return (
    <div
      ref={ref}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      tabIndex={0}
      className={`group border-t-2 pt-5 outline-none transition-colors duration-500 ${
        active ? "border-brass-bright" : "border-white/25"
      }`}
    >
      <span
        className={`block font-display text-7xl font-extrabold leading-none transition-colors duration-500 ${
          active ? "text-brass-bright" : "text-white/30"
        }`}
      >
        {String(idx + 1).padStart(2, "0")}
      </span>
      <p
        className={`eyebrow mt-7 transition-colors duration-500 ${
          active ? "text-brass-bright!" : "text-white/50!"
        }`}
      >
        {title}
      </p>
      <p
        className={`mt-2.5 text-lg leading-relaxed transition-colors duration-500 ${
          active ? "text-white" : "text-white/60"
        }`}
      >
        {desc}
      </p>
    </div>
  );
}
