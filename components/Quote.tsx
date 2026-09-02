import { site } from "@/content/site";
import Reveal from "./motion/Reveal";

export default function Quote() {
  return (
    <section className="bg-navy py-28 text-white">
      <Reveal className="mx-auto max-w-4xl px-6 text-center">
        <span className="display-italic block text-8xl leading-none text-goldaccent">
          &ldquo;
        </span>
        <p className="display-xl -mt-4 text-[2rem] leading-[1.3] text-white text-balance sm:text-[2.6rem]">
          {site.quote.text}
        </p>
        <div className="mx-auto mt-10 h-[3px] w-14 bg-goldaccent" />
        {site.quote.author && (
          <cite className="mt-5 block text-sm not-italic tracking-wide text-white/60">
            — {site.quote.author}
          </cite>
        )}
      </Reveal>
    </section>
  );
}
