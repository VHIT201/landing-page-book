import Image from "next/image";
import { site } from "@/content/site";
import BookCover from "./BookCover";
import Icon from "./Icon";

export default function Hero() {
  const { hero, cta } = site;
  return (
    <section
      id="hero"
      className="relative flex min-h-[92vh] items-center overflow-hidden bg-navy text-white"
    >
      <Image
        src="/images/banner.jpeg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* overlay — tối bên trái + dưới cho chữ nổi */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/80 to-navy/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-transparent to-navy/40" />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-28 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p
            className="eyebrow rise text-brass-bright!"
            style={{ animationDelay: "0ms" }}
          >
            {hero.eyebrow}
          </p>
          <h1
            className="display-xl rise mt-5 text-6xl sm:text-7xl xl:text-8xl"
            style={{ animationDelay: "60ms" }}
          >
            {hero.titleLines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </h1>
          <p
            className="display-italic rise mt-3 text-3xl text-brass-bright"
            style={{ animationDelay: "120ms" }}
          >
            {site.brand.tagline}
          </p>
          <p
            className="rise mt-6 max-w-xl text-lg leading-relaxed text-white/80"
            style={{ animationDelay: "180ms" }}
          >
            {hero.subtitle}
          </p>

          <div
            className="rise mt-9 flex flex-wrap gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <a
              href={cta.primaryHref}
              className="inline-flex items-center gap-2 rounded-sm bg-goldaccent px-7 py-3.5 font-semibold text-navy transition-colors hover:brightness-95"
            >
              {cta.primaryLabel}
            </a>
            <a
              href={cta.secondaryHref}
              className="inline-flex items-center gap-2 rounded-sm border border-white/40 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Icon name="play" className="h-4 w-4" />
              {cta.secondaryLabel}
            </a>
          </div>
        </div>

        {/* sách 3D nổi trên ảnh */}
        <div
          className="rise relative mx-auto hidden w-56 sm:w-64 lg:block xl:w-72"
          style={{ animationDelay: "160ms" }}
        >
          <div className="absolute -inset-10 rounded-full bg-brass-bright/20 blur-3xl" />
          <div className="relative">
            <BookCover />
          </div>
        </div>
      </div>
    </section>
  );
}
