import { site } from "@/content/site";

export default function Footer() {
  const f = site.footer;
  return (
    <footer className="border-t border-line bg-paper py-12">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 md:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">
            {site.brand.name}
            <sup className="ml-0.5 text-brass">{site.brand.trademark}</sup>
          </p>
          <p className="display-italic mt-1 text-base text-brass">
            {site.brand.tagline}
          </p>
        </div>

        <FooterCol title={f.linksTitle} items={f.links} />
        <FooterCol title={f.policyTitle} items={f.policies} />
        <FooterCol title={f.socialTitle} items={f.socials} />
      </div>
      <p className="mx-auto mt-10 max-w-7xl border-t border-line px-5 pt-6 text-center text-xs uppercase tracking-wider text-ink-faint sm:px-6">
        {f.copyright}
      </p>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {items.map((it) => (
          <li key={it.label}>
            <a
              href={it.href}
              className="text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
