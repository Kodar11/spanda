interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spandan-logo-gradient" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      {/* Central S-shaped wave */}
      <path
        d="M16 18c0-4.4 3.6-8 8-8h8c4.4 0 8 3.6 8 8s-3.6 8-8 8h-8c-4.4 0-8 3.6-8 8s3.6 8 8 8h8c4.4 0 8-3.6 8-8"
        stroke="url(#spandan-logo-gradient)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Subtle ripple arcs */}
      <path
        d="M10 24c0-8 6-14 14-14"
        stroke="url(#spandan-logo-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
        fill="none"
      />
      <path
        d="M38 24c0 8-6 14-14 14"
        stroke="url(#spandan-logo-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
        fill="none"
      />
    </svg>
  )
}
