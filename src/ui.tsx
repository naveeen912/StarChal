import { ReactNode, useState } from 'react';
import { sfx } from './audio';

export function Btn({ children, onClick, kind = 'ghost', disabled, className = '' }: { children: ReactNode; onClick: () => void; kind?: 'gold' | 'ghost'; disabled?: boolean; className?: string }) {
  return <button type="button" disabled={disabled} className={`btn ${kind} ${className}`} onClick={() => { sfx.tap(); onClick(); }}>{children}</button>;
}
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <section className={'card ' + className}>{children}</section>;
export const Logo = () => <h1 className="logo">STAR CHAL</h1>;
export const Err = ({ text }: { text: string }) => (text ? <p className="err" role="alert">{text}</p> : null);

export function ShareButton({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  const url = `${location.origin}${location.pathname}?room=${code}`;
  const go = async () => {
    const text = `Play Star Chal with me! Room code: ${code}`;
    try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* clipboard blocked */ }
  };
  return <Btn onClick={go}>{done ? '✓ Link copied' : '🔗 Share invite link'}</Btn>;
}

export function Confetti() {
  const e = ['⭐', '✨', '🎉', '🐯', '🐐', '💛'];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span key={i} style={{ left: Math.random() * 100 + '%', animationDuration: 2 + Math.random() * 2.5 + 's', animationDelay: Math.random() * 0.8 + 's' }}>{e[i % e.length]}</span>
      ))}
    </div>
  );
}
