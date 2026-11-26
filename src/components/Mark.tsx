// STM mark: a dial with six era notches and a sweeping hand.
export default function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13.5" stroke="url(#stm-g)" strokeWidth="1.5" />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        return <line key={i} x1={16 + Math.cos(a) * 10} y1={16 + Math.sin(a) * 10} x2={16 + Math.cos(a) * 12.5} y2={16 + Math.sin(a) * 12.5} stroke="#ececf1" strokeOpacity={i === 5 ? 1 : 0.35} strokeWidth="1.5" strokeLinecap="round" />;
      })}
      <path d="M16 16 L16 7.5" stroke="#ececf1" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 16 L22.5 12.3" stroke="#67e8f9" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.8" fill="#ececf1" />
      <defs>
        <linearGradient id="stm-g" x1="4" y1="4" x2="28" y2="28">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
      </defs>
    </svg>
  );
}
