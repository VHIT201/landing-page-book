"use client";

import { useEffect, useState } from "react";
import { site } from "@/content/site";
import Icon from "./Icon";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // solid khi cuộn hoặc khi menu mobile mở
  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid
          ? "border-b border-line bg-paper/90 text-ink backdrop-blur"
          : "border-b border-transparent bg-transparent text-white"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <a href="#hero" className="flex flex-col leading-none">
          <span className="font-display text-lg font-semibold tracking-tight">
            {site.brand.name}
            <sup
              className={solid ? "ml-0.5 text-brass" : "ml-0.5 text-brass-bright"}
            >
              {site.brand.trademark}
            </sup>
          </span>
          <span
            className={`mt-0.5 text-[10px] tracking-[0.2em] ${
              solid ? "text-ink-faint" : "text-white/60"
            }`}
          >
            {site.brand.tagline}
          </span>
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {site.nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className={`text-sm transition-colors ${
                solid
                  ? "text-ink-soft hover:text-ink"
                  : "text-white/80 hover:text-white"
              }`}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={site.cta.primaryHref}
            className={`hidden rounded-sm px-5 py-2.5 text-sm font-semibold transition-colors lg:inline-block ${
              solid
                ? "bg-brass text-white hover:bg-accent-deep"
                : "bg-goldaccent text-navy hover:brightness-95"
            }`}
          >
            {site.cta.primaryLabel}
          </a>
          <button
            type="button"
            aria-label="Mở menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-sm p-2 lg:hidden"
          >
            <Icon name={open ? "close" : "menu"} className="h-6 w-6" />
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-paper px-5 py-3 text-ink lg:hidden">
          {site.nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-ink-soft hover:text-ink"
            >
              {n.label}
            </a>
          ))}
          <a
            href={site.cta.primaryHref}
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-sm bg-brass px-4 py-2.5 text-center text-sm font-semibold text-white"
          >
            {site.cta.primaryLabel}
          </a>
        </nav>
      )}
    </header>
  );
}
