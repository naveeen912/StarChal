import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Board as BoardT, Role } from '../game/types';
import { EDGES, NODE, NODES, NODE_IDS, SIZE, legalMoves } from '../game/board';
import { GoatIcon, TigerIcon } from './Icons';
import { sfx } from '../audio';

interface P { key: number; role: Role; node: string; dying?: boolean }
interface Fx { key: number; node: string; color: string }
const pct = (v: number) => (v / SIZE) * 100 + '%';
const CY = SIZE / 2;

function Line({ a, b }: { a: string; b: string }) {
  const A = NODE[a], B = NODE[b];
  return (
    <Fragment>
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#E8B23C" strokeWidth="14" opacity=".18" strokeLinecap="round" />
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#F6D77E" strokeWidth="3.6" opacity=".95" strokeLinecap="round" />
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#fff" strokeWidth="2" opacity=".5" strokeLinecap="round" className="flow" />
    </Fragment>
  );
}

/** Closed path around the 10 points so the board reads as a five-point star, not a circle. */
const STAR_HULL = [...NODES]
  .sort((p, q) => Math.atan2(p.y - CY, p.x - CY) - Math.atan2(q.y - CY, q.x - CY))
  .map((n) => `${n.x},${n.y}`)
  .join(' ');

/** Keeps piece identity across snapshots so pieces glide, drop in and vanish. */
function usePieces(board: BoardT, turnCount: number) {
  const [pieces, setPieces] = useState<P[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  const prev = useRef<BoardT | null>(null), nk = useRef(1);
  const burst = (node: string, color: string) => {
    const key = nk.current++;
    setFx((f) => [...f, { key, node, color }]);
    setTimeout(() => setFx((f) => f.filter((q) => q.key !== key)), 700);
  };
  useEffect(() => {
    const pb = prev.current;
    prev.current = { ...board };
    if (!pb || turnCount === 0) {
      setPieces(NODE_IDS.filter((i) => board[i]).map((i) => ({ key: nk.current++, role: board[i]!, node: i })));
      return;
    }
    const removed: string[] = [], added: string[] = [];
    NODE_IDS.forEach((i) => { if (pb[i] && !board[i]) removed.push(i); else if (!pb[i] && board[i]) added.push(i); });
    if (!removed.length && !added.length) return;
    const moves: { from: string; to: string }[] = [], fresh: string[] = [];
    added.forEach((id) => {
      const k = removed.findIndex((r) => pb[r] === board[id]);
      if (k >= 0) moves.push({ from: removed.splice(k, 1)[0], to: id }); else fresh.push(id);
    });
    setPieces((cur) => {
      const next = cur.filter((p) => !p.dying).map((p) => ({ ...p }));
      moves.forEach((m) => { const p = next.find((x) => x.node === m.from); if (p) p.node = m.to; });
      fresh.forEach((id) => next.push({ key: nk.current++, role: board[id]!, node: id }));
      removed.forEach((id) => { const p = next.find((x) => x.node === id); if (p) p.dying = true; });
      return next;
    });
    moves.forEach((m) => burst(m.to, '#F6D77E')); fresh.forEach((id) => burst(id, '#F6D77E')); removed.forEach((id) => burst(id, '#E85D5D'));
    if (removed.length) sfx.capture(); else if (fresh.length) sfx.place(); else sfx.move();
  }, [board, turnCount]);
  useEffect(() => {
    if (!pieces.some((p) => p.dying)) return;
    const t = setTimeout(() => setPieces((c) => c.filter((p) => !p.dying)), 480);
    return () => clearTimeout(t);
  }, [pieces]);
  return { pieces, fx };
}

export function BoardView({ board, turnCount, selected, canPlace, onNode }: {
  board: BoardT; turnCount: number; selected: string | null; canPlace: boolean; onNode: (id: string) => void;
}) {
  const { pieces, fx } = usePieces(board, turnCount);
  const legal = useMemo(() => (selected && board[selected] ? legalMoves(selected, board) : []), [selected, board]);
  const at = (id: string) => ({ left: pct(NODE[id].x), top: pct(NODE[id].y) });
  return (
    <div className="board" role="group" aria-label="Game board">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="board-svg" aria-hidden="true">
        <defs>
          <radialGradient id="gb" cx="50%" cy="50%" r="72%"><stop offset="0" stopColor="#3A2A78" stopOpacity=".65" /><stop offset="1" stopColor="#241A52" stopOpacity="0" /></radialGradient>
        </defs>
        <polygon points={STAR_HULL} fill="url(#gb)" stroke="rgba(246,215,126,.12)" strokeWidth="2" strokeLinejoin="round" />
        {EDGES.map(([a, b], i) => <Line key={i} a={a} b={b} />)}
        {NODES.map((n) => (<Fragment key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.type === 'outer' ? 17 : 14} fill="#1A1240" stroke="#F6D77E" strokeWidth="2.4" />
          <circle cx={n.x} cy={n.y} r={n.type === 'outer' ? 6 : 5} fill="#E8B23C" opacity=".7" />
        </Fragment>))}
        {selected && <circle cx={NODE[selected].x} cy={NODE[selected].y} r="32" fill="none" stroke="#F6D77E" strokeWidth="3.5" strokeDasharray="8 6" />}
      </svg>
      {canPlace && NODE_IDS.filter((i) => board[i] === null).map((i) => <div key={'p' + i} className="pulse" style={at(i)}><i /></div>)}
      {legal.map((m) => <div key={'l' + m.to} className="pulse" style={at(m.to)}><i /></div>)}
      {legal.filter((m) => m.capture).map((m) => <div key={'c' + m.capture} className="pulse bad" style={at(m.capture!)}><i /></div>)}
      {fx.map((f) => <div key={f.key} className="fx" style={{ ...at(f.node), ['--c' as string]: f.color }}><i /></div>)}
      {pieces.map((p) => (
        <div key={p.key} className={'piece' + (p.dying ? ' dying' : '')} style={at(p.node)}>
          <div className="pi">{p.role === 'tiger' ? <TigerIcon /> : <GoatIcon />}</div>
        </div>
      ))}
      {NODES.map((n) => (
        <button key={n.id} type="button" className="node" style={at(n.id)} onClick={() => onNode(n.id)}
          aria-label={`Point ${n.id}: ${board[n.id] ?? 'empty'}${selected === n.id ? ', selected' : ''}`} />
      ))}
    </div>
  );
}
