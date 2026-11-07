let on = localStorage.getItem('sc_snd') !== '0';
let ctx: AudioContext | null = null;
export const soundOn = () => on;
export function setSound(v: boolean) { on = v; localStorage.setItem('sc_snd', v ? '1' : '0'); }
function tone(f: number, d: number, type: OscillatorType = 'sine', v = 0.13, delay = 0, slide = 0) {
  if (!on) return;
  try {
    ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02);
  } catch { /* audio unavailable */ }
}
export const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };
export const sfx = {
  tap: () => tone(660, 0.06, 'triangle', 0.08),
  place: () => { tone(300, 0.14, 'sine', 0.2, 0, 120); tone(760, 0.1, 'triangle', 0.08, 0.05); },
  move: () => tone(420, 0.12, 'triangle', 0.12, 0, 560),
  capture: () => { tone(180, 0.35, 'sawtooth', 0.16, 0, 60); tone(90, 0.4, 'square', 0.12, 0.03, 40); buzz(80); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.13)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'sine', 0.13, i * 0.18)),
  turn: () => tone(880, 0.08, 'sine', 0.07),
};
