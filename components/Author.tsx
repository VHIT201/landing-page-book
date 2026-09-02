import { site } from "@/content/site";
import AuthorPhoto from "./AuthorPhoto";
import Counter from "./motion/Counter";
import Reveal from "./motion/Reveal";

export default function Author() {
  const a = site.author;
  return (
    <section id="tac-gia" className="bg-paper py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 md:grid-cols-[minmax(0,25rem)_1fr] md:items-center md:gap-16">
        <Reveal className="mx-auto w-72 md:mx-0 md:w-full">
          <AuthorPhoto src={a.photo} alt={a.photoAlt} />
        </Reveal>

        <div>
          <Reveal>
            <p className="eyebrow">{a.sectionLabel}</p>
            <h2 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
              {a.name}
            </h2>
            <p className="display-italic mt-3 text-2xl text-brass">{a.role}</p>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft">
              {a.bio}
            </p>
          </Reveal>

          <Reveal delay={0.14}>
            <dl className="mt-10 flex flex-wrap gap-x-14 gap-y-6 border-t border-line pt-8">
              {a.stats.map((s) => (
                <div key={s.label}>
                  <dt className="font-display text-4xl font-bold text-ink sm:text-5xl">
                    <Counter value={s.value} />
                  </dt>
                  <dd className="mt-1.5 max-w-[9rem] text-xs uppercase tracking-[0.12em] text-ink-faint">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <p className="mt-7 text-xs text-ink-faint">{a.publisher}</p>
        </div>
      </div>
    </section>
  );
}
