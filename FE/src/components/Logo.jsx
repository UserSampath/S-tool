// The S tools mark: a violet badge holding an "S" over four dots, one per PIN
// digit. Same artwork as public/favicon.svg, inlined so it can be sized and
// animated with the rest of the UI. Gradient ids are suffixed so more than one
// logo can sit on a page without the defs colliding.
function Logo({ size = 62, variant = "app", className = "" }) {
  const badgeId = `stools-badge-${variant}`;
  const shineId = `stools-shine-${variant}`;

  return (
    <svg
      className={`stools-logo ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="S tools"
    >
      <defs>
        <linearGradient id={badgeId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c084fc" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="18" fill={`url(#${badgeId})`} />
      <rect width="64" height="32" rx="18" fill={`url(#${shineId})`} />

      <path
        transform="translate(0 -2)"
        d="M43 22c0-4.4-4.9-7-11-7s-11 2.6-11 7c0 8.5 22 4.5 22 13 0 4.4-4.9 7-11 7s-11-2.6-11-7"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
      />

      <g fill="#ffffff" fillOpacity="0.92" transform="translate(0 -2)">
        <circle cx="23" cy="51" r="2.6" />
        <circle cx="29" cy="51" r="2.6" />
        <circle cx="35" cy="51" r="2.6" />
        <circle cx="41" cy="51" r="2.6" />
      </g>
    </svg>
  );
}

export default Logo;
