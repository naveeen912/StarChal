import { useEffect, useRef } from 'react';

type Star = { bx: number; by: number; r: number; p: number; s: number; z: number };
type Mist = { x: number; y: number; r: number; hue: number; phase: number; drift: number };

export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, d = 1, raf = 0;
    let stars: Star[] = [];
    let mists: Mist[] = [];
    let shoot: { x: number; y: number; l: number; vx: number; vy: number } | null = null;
    let t0 = performance.now();
    let parX = 0, parY = 0, aimX = 0, aimY = 0;

    const resize = () => {
      d = Math.min(devicePixelRatio || 1, 2);
      W = c.width = innerWidth * d;
      H = c.height = innerHeight * d;
      const n = Math.round(Math.min(220, (innerWidth * innerHeight) / 6500));
      stars = Array.from({ length: n }, () => ({
        bx: Math.random() * W,
        by: Math.random() * H,
        r: (Math.random() * 1.6 + 0.25) * d * (0.6 + Math.random() * 0.7),
        p: Math.random() * Math.PI * 2,
        s: 0.4 + Math.random() * 1.6,
        z: Math.random(),
      }));
      mists = [
        { x: W * 0.25, y: H * 0.35, r: Math.max(W, H) * 0.55, hue: 265, phase: 0, drift: 0.00018 },
        { x: W * 0.78, y: H * 0.62, r: Math.max(W, H) * 0.45, hue: 295, phase: 1.8, drift: 0.00014 },
        { x: W * 0.5, y: H * 0.85, r: Math.max(W, H) * 0.35, hue: 235, phase: 3.1, drift: 0.00012 },
      ];
      if (reduce) draw(performance.now() - t0);
    };

    const onPointer = (e: PointerEvent) => {
      aimX = e.clientX / innerWidth - 0.5;
      aimY = e.clientY / innerHeight - 0.5;
    };

    const draw = (elapsed: number) => {
      const t = elapsed / 1000;
      parX += (aimX - parX) * 0.04;
      parY += (aimY - parY) * 0.04;

      const gx = W / 2 + Math.sin(t * 0.12) * W * 0.08 + parX * W * 0.06;
      const gy = H * 0.08 + Math.cos(t * 0.09) * H * 0.06 + parY * H * 0.05;
      const g = ctx.createRadialGradient(gx, gy, 0, W / 2, H * 0.55, Math.max(H, W) * 1.15);
      g.addColorStop(0, '#322878');
      g.addColorStop(0.45, '#18103A');
      g.addColorStop(1, '#06040E');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      if (!reduce) {
        mists.forEach((m) => {
          const ox = Math.sin(t * 0.15 + m.phase) * W * 0.06 + parX * W * 0.12;
          const oy = Math.cos(t * 0.11 + m.phase) * H * 0.05 + parY * H * 0.1;
          const gr = ctx.createRadialGradient(m.x + ox, m.y + oy, 0, m.x + ox, m.y + oy, m.r);
          gr.addColorStop(0, `hsla(${m.hue}, 72%, 58%, 0.14)`);
          gr.addColorStop(0.55, `hsla(${m.hue + 20}, 65%, 38%, 0.06)`);
          gr.addColorStop(1, 'hsla(260, 50%, 20%, 0)');
          ctx.fillStyle = gr;
          ctx.fillRect(0, 0, W, H);
        });
      }

      stars.forEach((s) => {
        const drift = reduce ? 0 : (0.08 + s.z * 0.38) * d;
        const angle = t * 0.04 + s.p + s.z * 2.2;
        const scrollY = reduce ? 0 : -t * drift * 28;
        const scrollX = reduce ? 0 : Math.sin(angle) * drift * 6;
        let x = s.bx + scrollX + parX * (18 + s.z * 42) * d;
        let y = s.by + scrollY + parY * (14 + s.z * 36) * d;
        const wrap = Math.max(W, H) * 1.2;
        x = ((x % wrap) + wrap) % wrap;
        y = ((y % wrap) + wrap) % wrap;

        const tw = 0.32 + 0.68 * Math.abs(Math.sin(t * s.s + s.p));
        ctx.globalAlpha = (0.25 + s.z * 0.55) * tw;
        ctx.fillStyle = s.z > 0.65 ? '#FFF8E7' : '#E8DCFF';
        ctx.beginPath();
        ctx.arc(x, y, s.r * (0.85 + s.z * 0.35), 0, Math.PI * 2);
        ctx.fill();
      });

      if (!reduce) {
        if (!shoot && Math.random() < 0.006) {
          const vx = (10 + Math.random() * 8) * d;
          shoot = { x: Math.random() * W, y: Math.random() * H * 0.45, l: 0, vx, vy: vx * 0.45 };
        }
        if (shoot) {
          const tail = shoot.vx * 5;
          ctx.globalAlpha = Math.max(0, 1 - shoot.l / 48);
          const lg = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - tail, shoot.y - tail * 0.45);
          lg.addColorStop(0, '#FFF6D0');
          lg.addColorStop(1, 'rgba(255,246,208,0)');
          ctx.strokeStyle = lg;
          ctx.lineWidth = 2.4 * d;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(shoot.x, shoot.y);
          ctx.lineTo(shoot.x - tail, shoot.y - tail * 0.45);
          ctx.stroke();
          shoot.x += shoot.vx;
          shoot.y += shoot.vy;
          if (++shoot.l > 48) shoot = null;
        }
        raf = requestAnimationFrame((now) => draw(now - t0));
      }
      ctx.globalAlpha = 1;
    };

    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', onPointer);
    if (!reduce) raf = requestAnimationFrame((now) => draw(now - t0));
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onPointer);
    };
  }, []);
  return <canvas ref={ref} className="bg" aria-hidden="true" />;
}
