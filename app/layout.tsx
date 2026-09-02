import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Be_Vietnam_Pro } from "next/font/google";
import { site } from "@/content/site";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const accent = Fraunces({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500"],
  style: ["italic"],
  variable: "--font-accent",
  display: "swap",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const url = site.meta.siteUrl;

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: site.meta.title,
  description: site.meta.description,
  keywords: site.meta.keywords,
  alternates: { canonical: "/" },
  authors: [{ name: site.author.name }],
  openGraph: {
    type: "website",
    locale: site.meta.locale,
    url: "/",
    title: site.meta.title,
    description: site.meta.description,
    siteName: site.brand.name,
    // ảnh share sinh tự động bởi app/opengraph-image.tsx — không cần file tĩnh
  },
  twitter: {
    card: "summary_large_image",
    title: site.meta.title,
    description: site.meta.description,
    site: site.meta.twitterHandle,
  },
  robots: { index: true, follow: true },
};

function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: `${site.brand.name} — ${site.brand.tagline}`,
    author: { "@type": "Person", name: site.author.name },
    publisher: { "@type": "Organization", name: site.author.publisher },
    inLanguage: "vi",
    url,
    image: `${url}${site.hero.coverImage}`,
    description: site.meta.description,
    offers: {
      "@type": "Offer",
      price: site.finalCta.price.replace(/[^\d]/g, ""),
      priceCurrency: "VND",
      availability: "https://schema.org/InStock",
      url: `${url}${site.cta.primaryHref}`,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      reviewCount: String(site.reviews.length),
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      className={`${display.variable} ${accent.variable} ${body.variable}`}
    >
      <body>
        <div className="grain" aria-hidden />
        {children}
        <JsonLd />
      </body>
    </html>
  );
}
