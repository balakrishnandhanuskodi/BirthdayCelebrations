/** An aeroplane towing a waving "Happy Birthday Charuta!" banner across the page. */
export function BirthdayPlane({ top = "9%", duration = 22, delay = 0, reverse = false }: { top?: string; duration?: number; delay?: number; reverse?: boolean }) {
  const text = "HAPPY BIRTHDAY CHARUTA! 🎂";
  return (
    <div className={`bday-plane ${reverse ? "rev" : ""}`} style={{ top, animationDuration: `${duration}s`, animationDelay: `${delay}s` }} aria-hidden="true">
      <svg className="plane-svg" viewBox="0 0 118 50" width="118" height="50">
        <defs>
          <linearGradient id="bp-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".55" stopColor="#f2f5fb" />
            <stop offset="1" stopColor="#c3cde2" />
          </linearGradient>
          <linearGradient id="bp-fin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff6b85" />
            <stop offset="1" stopColor="#d83a59" />
          </linearGradient>
          <linearGradient id="bp-wing" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#cfd7e8" />
          </linearGradient>
          <linearGradient id="bp-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#aae8fa" stopOpacity=".9" />
            <stop offset="1" stopColor="#3ca0cd" stopOpacity=".8" />
          </linearGradient>
          <radialGradient id="bp-nose" cx=".3" cy=".4" r=".8">
            <stop offset="0" stopColor="#fff3b0" />
            <stop offset="1" stopColor="#f0b429" />
          </radialGradient>
          <clipPath id="bp-clip">
            <path d="M-14 0C-14-9-4-12 10-12L58-9C72-8 82-6 88-3L88 1C78 5 66 8 52 9L8 10C-6 10-14 7-14 0Z" />
          </clipPath>
        </defs>
        <g transform="translate(26 27)">
          {/* far wing + tailplane */}
          <path d="M20-8L34-15L42-15L40-8Z" fill="#c7cfe0" />
          <path d="M34-15L42-15L41.2-13L33-13Z" fill="#e9455f" />
          <path d="M72-5L80-10L85-10L84-4Z" fill="#c7cfe0" />
          {/* tail fin */}
          <path d="M64-7L76-23Q81-28 85-23L87-4Z" fill="url(#bp-fin)" />
          <text x="80" y="-12" fontSize="8" textAnchor="middle" fill="#fff">♥</text>
          {/* fuselage */}
          <path d="M-14 0C-14-9-4-12 10-12L58-9C72-8 82-6 88-3L88 1C78 5 66 8 52 9L8 10C-6 10-14 7-14 0Z" fill="url(#bp-body)" stroke="rgba(60,50,100,.22)" strokeWidth=".8" />
          <g clipPath="url(#bp-clip)">
            <path d="M-16 0C20-2 60-1 92-4L92-1C60 2 20 1.5-16 3Z" fill="#e9455f" />
            <path d="M-16 3C20 1.5 60 2 92-1L92 .6C60 3.6 20 3.2-16 4.6Z" fill="#ffd84d" />
          </g>
          {[22, 30, 38, 46, 54].map((wx) => (
            <g key={wx}>
              <rect x={wx} y="-7.5" width="4.6" height="4" rx="1.6" fill="#6fc6e8" />
              <rect x={wx + 0.8} y="-7" width="1.2" height="1.4" fill="rgba(255,255,255,.8)" />
            </g>
          ))}
          {/* pilot, scarf, canopy */}
          <path className="bp-scarf" d="M6-14Q13-17 20-15L19-12.5Q13-13.5 7-12Z" fill="#ff8fb8" />
          <circle cx="4" cy="-12.5" r="3" fill="#382444" />
          <rect x="1.5" y="-13.6" width="5" height="1.1" fill="#ffd84d" />
          <path d="M-5-10.5Q-2-19 7-18.5Q12-18 13-11.5Z" fill="url(#bp-glass)" />
          <path d="M-1.5-12.5Q0-16.5 5-17" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.2" strokeLinecap="round" />
          {/* near wing + tailplane */}
          <path d="M18 3L42 3L37 13Q35 15.5 31 15L24 14Z" fill="url(#bp-wing)" stroke="rgba(60,50,100,.25)" strokeWidth=".8" />
          <path d="M25.5 12L37.8 11.4L37 13Q35 15.5 31 15L24 14Z" fill="#e9455f" />
          <path d="M72 1L86 0L84 6L77 6Z" fill="#e3e8f2" />
          {/* nose + propeller */}
          <path d="M-13-5.5Q-24 0-13 5.5Z" fill="url(#bp-nose)" />
          <ellipse cx="-21" cy="0" rx="2.6" ry="17" fill="rgba(90,80,130,.16)" />
          <rect className="prop" x="-22.2" y="-16" width="2.4" height="32" rx="1.2" fill="rgba(70,60,100,.8)" />
        </g>
      </svg>
      <span className="plane-rope" />
      <div className="plane-banner">
        {[...text].map((ch, i) => (
          <span key={i} style={{ animationDelay: `${-i * 0.09}s` }}>
            {ch === " " ? " " : ch}
          </span>
        ))}
        <i className="banner-tail" />
      </div>
    </div>
  );
}
