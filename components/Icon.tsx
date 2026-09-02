type IconProps = { name: string; className?: string };

const paths: Record<string, React.ReactNode> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </>
  ),
  rocket: (
    <path d="M5 15c-1 1-1 4-1 4s3 0 4-1m8.5-11.5C18 3 21 3 21 3s0 3-1.5 4.5L12 15l-3-3zM9 12l-3 1m6 6 1-3" />
  ),
  flag: <path d="M5 21V4m0 0 9 3-3 3 3 3-9 3" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 6a3 3 0 0 1 0 6m2 8c0-2.5-1.5-4-3-4.5" />
    </>
  ),
  book: <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2zM5 4v16" />,
  check: <path d="m5 13 4 4L19 7" />,
  star: (
    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />
  ),
  truck: (
    <>
      <path d="M2 7h11v9H2zM13 10h4l3 3v3h-7" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  refresh: (
    <path d="M4 10a8 8 0 0 1 13-4l3 2M20 14a8 8 0 0 1-13 4l-3-2M17 4v4h-4M7 20v-4h4" />
  ),
  shield: <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" />,
  play: <path d="M8 5v14l11-7z" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
};

export default function Icon({ name, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] ?? paths.book}
    </svg>
  );
}
