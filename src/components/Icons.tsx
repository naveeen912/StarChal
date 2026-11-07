import { useId } from 'react';

export function TigerIcon({ className }: { className?: string }) {
  const id = 'gt' + useId().replace(/:/g, '');
  return (
    <svg viewBox="-34 -34 68 68" className={className} aria-hidden="true">
      <defs><radialGradient id={id} cx="35%" cy="28%" r="75%"><stop offset="0" stopColor="#FFA95E" /><stop offset="1" stopColor="#C4561B" /></radialGradient></defs>
      <ellipse cx="0" cy="26" rx="19" ry="5" fill="rgba(0,0,0,.4)" />
      <circle cx="-17" cy="-15" r="8.5" fill="#B94E16" /><circle cx="17" cy="-15" r="8.5" fill="#B94E16" />
      <circle cx="-17" cy="-15" r="4" fill="#F7B38A" /><circle cx="17" cy="-15" r="4" fill="#F7B38A" />
      <circle r="24" fill={`url(#${id})`} stroke="#6B2C0C" strokeWidth="2.2" />
      <path d="M-3.5-23L0-13L3.5-23Z M-9-22L-5-14L-3-22Z M9-22L5-14L3-22Z" fill="#3b1606" />
      <path d="M-24-5L-13-3L-23 4Z M24-5L13-3L23 4Z M-23 9L-14 7L-21 14Z M23 9L14 7L21 14Z" fill="#3b1606" />
      <ellipse cx="0" cy="9" rx="12" ry="9" fill="#FBE3CF" />
      <circle cx="-8.5" cy="-3" r="4.4" fill="#F2D14B" stroke="#3b1606" strokeWidth="1" /><circle cx="8.5" cy="-3" r="4.4" fill="#F2D14B" stroke="#3b1606" strokeWidth="1" />
      <ellipse cx="-8.5" cy="-3" rx="1.2" ry="3.4" fill="#111" /><ellipse cx="8.5" cy="-3" rx="1.2" ry="3.4" fill="#111" />
      <path d="M-14-8L-4-5M14-8L4-5" stroke="#3b1606" strokeWidth="2" strokeLinecap="round" />
      <path d="M-3.5 4h7L0 9Z" fill="#E0607A" />
      <path d="M0 9v4M0 13q-4 3-7 0M0 13q4 3 7 0" stroke="#3b1606" fill="none" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function GoatIcon({ className }: { className?: string }) {
  const id = 'gg' + useId().replace(/:/g, '');
  return (
    <svg viewBox="-34 -34 68 68" className={className} aria-hidden="true">
      <defs><radialGradient id={id} cx="35%" cy="28%" r="75%"><stop offset="0" stopColor="#FFFBEE" /><stop offset="1" stopColor="#D4C195" /></radialGradient></defs>
      <ellipse cx="0" cy="26" rx="19" ry="5" fill="rgba(0,0,0,.4)" />
      <path d="M-9-18Q-28-34-31-12M9-18Q28-34 31-12" stroke="#7d6232" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M-9-18Q-28-34-31-12M9-18Q28-34 31-12" stroke="#B89A5B" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="-23" cy="-3" rx="10" ry="4.6" transform="rotate(-25 -23 -3)" fill="#E3D2A6" stroke="#9C875A" strokeWidth="1.5" />
      <ellipse cx="23" cy="-3" rx="10" ry="4.6" transform="rotate(25 23 -3)" fill="#E3D2A6" stroke="#9C875A" strokeWidth="1.5" />
      <path d="M-5 17Q0 36 5 17Z" fill="#E8DABB" stroke="#9C875A" strokeWidth="1.4" />
      <circle r="22" fill={`url(#${id})`} stroke="#9C875A" strokeWidth="2.2" />
      <ellipse cx="0" cy="9" rx="10" ry="9" fill="#FBF3DE" />
      <ellipse cx="-8.5" cy="-4" rx="4.6" ry="3.4" fill="#fff" stroke="#8a7440" strokeWidth="1" /><ellipse cx="8.5" cy="-4" rx="4.6" ry="3.4" fill="#fff" stroke="#8a7440" strokeWidth="1" />
      <rect x="-10.5" y="-5.2" width="4" height="2.4" rx="1" fill="#222" /><rect x="6.5" y="-5.2" width="4" height="2.4" rx="1" fill="#222" />
      <circle cx="-3.4" cy="9" r="1.5" fill="#6b5a35" /><circle cx="3.4" cy="9" r="1.5" fill="#6b5a35" />
      <path d="M0 13v3M0 16q-3 2-5 0M0 16q3 2 5 0" stroke="#6b5a35" fill="none" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
