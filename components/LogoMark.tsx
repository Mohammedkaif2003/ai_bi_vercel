type LogoMarkProps = {
  size?: number;
  label?: string;
  className?: string;
};

export default function LogoMark({
  size = 32,
  label = "Nexlytics",
  className = "",
}: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="14"
        fill="#0B1120"
        stroke="#334155"
        strokeWidth="2"
      />
      <rect x="16" y="16" width="8" height="32" rx="4" fill="#818CF8" />
      <rect x="40" y="16" width="8" height="32" rx="4" fill="#818CF8" />
      <path
        d="M23 43L32 30L41 21"
        stroke="#22D3EE"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="43" cy="19" r="5" fill="#10B981" />
      <circle cx="43" cy="19" r="2" fill="#ECFEFF" />
    </svg>
  );
}
