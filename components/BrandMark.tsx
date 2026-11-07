import React from "react";

type Props = { size?: number; className?: string };

export function BrandMark({ size = 42, className }: Props) {
  return <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Нишони TJS Edu">
    <defs><linearGradient id="tjs-roof" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#42a5f5"/><stop offset="1" stopColor="#0757a6"/></linearGradient></defs>
    <path d="M8 28 32 8l24 20-24-8L8 28Z" fill="url(#tjs-roof)" stroke="#d9efff" strokeWidth="1.5"/>
    <path d="M17 29v13h30V29L32 19 17 29Z" fill="#f8fbff" stroke="#0c477b" strokeWidth="1.5"/>
    <path d="M23 32h18v10H23z" fill="#dcecf9"/><path d="M29 32v10h6V32" fill="#0c477b"/>
    <path d="M32 8v-4" stroke="#e7b34b" strokeWidth="2.5" strokeLinecap="round"/><path d="M32 4h11l-3 4 3 4H32" fill="#d92535"/>
    <path d="M7 47c9-5 17-5 25 0 8-5 16-5 25 0v8c-9-4-17-4-25 1-8-5-16-5-25-1v-8Z" fill="#fff" stroke="#0c477b" strokeWidth="1.8"/>
    <path d="M32 47v9" stroke="#0c477b" strokeWidth="1.5"/>
    <path d="m12 22 2-2m36 2-2-2" stroke="#d92535" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="25" r="1.2" fill="#e7b34b"/><circle cx="32" cy="23" r="1.2" fill="#e7b34b"/><circle cx="40" cy="25" r="1.2" fill="#e7b34b"/>
  </svg>;
}
