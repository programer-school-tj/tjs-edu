import React from "react";

type Props = { size?: number; className?: string };

export function BrandMark({ size = 42, className }: Props) {
  return <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Нишони TJS Edu бо мактаб, китоб, тоҷ ва ҳафт ситора">
    <defs>
      <linearGradient id="tjs-roof" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#42a5f5" />
        <stop offset="1" stopColor="#0757a6" />
      </linearGradient>
      <linearGradient id="tjs-book" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#dcecf9" />
      </linearGradient>
    </defs>

    {/* Crown and seven stars */}
    <path d="M24 8 26 2l6 4 6-4 2 6H24Z" fill="#e7b34b" stroke="#9b6a18" strokeWidth="1" strokeLinejoin="round" />
    <path d="M25 9h13" stroke="#9b6a18" strokeWidth="1.5" strokeLinecap="round" />
    {[9, 16.5, 24, 32, 40, 47.5, 55].map((x, i) =>
      <path key={i} d={`M${x} ${i === 3 ? 14 : i === 2 || i === 4 ? 15 : 17} l1.1 2.1 2.3.3-1.7 1.6.4 2.3-2.1-1.1-2.1 1.1.4-2.3-1.7-1.6 2.3-.3Z`} fill="#e7b34b" />
    )}

    {/* School building and Tajik flag */}
    <path d="m8 31 24-13 24 13-24-7L8 31Z" fill="url(#tjs-roof)" stroke="#d9efff" strokeWidth="1.4" />
    <path d="M16 31v16h32V31L32 24 16 31Z" fill="#f8fbff" stroke="#0c477b" strokeWidth="1.5" />
    <path d="M22 34h20v13H22z" fill="#dcecf9" />
    <path d="M29 34v13h6V34" fill="#0c477b" />
    <path d="M32 25v-5" stroke="#0c477b" strokeWidth="1.5" />
    <path d="M33 20h10l-2.5 3 2.5 3H33Z" fill="#d92535" />
    <path d="M33 20h10v2H33Z" fill="#fff" />
    <path d="M33 24h10v2H33Z" fill="#159447" />

    {/* Open book with the author's initials */}
    <path d="M6 49c9-5 17-5 26 0 9-5 17-5 26 0v9c-9-4-17-4-26 1-9-5-17-5-26-1v-9Z" fill="url(#tjs-book)" stroke="#0c477b" strokeWidth="1.7" />
    <path d="M32 49v10" stroke="#0c477b" strokeWidth="1.4" />
    <text x="21" y="56" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="#0c477b">Т.</text>
    <text x="43" y="56" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="#0c477b">С.</text>
  </svg>;
}
