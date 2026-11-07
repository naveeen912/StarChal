import { Board, GameDoc, Role } from './types';

export const SIZE = 600, CX = 300, CY = 300, R_OUT = 235;
export const GOATS = 7, WIN_CAPTURES = 4;
export interface NodeT { id: string; type: 'outer' | 'inner'; x: number; y: number; diag?: number[] }

const polar = (r: number, k: number) => {
  const a = ((-90 + k * 72) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
};
const outer: NodeT[] = [0, 1, 2, 3, 4].map((k) => ({ id: 'O' + k, type: 'outer', ...polar(R_OUT, k) }));
const diagonals: [number, number][] = [0, 1, 2, 3, 4].map((k) => [k, (k + 2) % 5]);

function intersect(p1: NodeT, p2: NodeT, p3: NodeT, p4: NodeT) {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;
  if (t < 0.001 || t > 0.999 || u < 0.001 || u > 0.999) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}
const seen: Record<string, { x: number; y: number; d: Set<number> }> = {};
for (let i = 0; i < 5; i++)
  for (let j = i + 1; j < 5; j++) {
    const [a1, a2] = diagonals[i], [b1, b2] = diagonals[j];
    if ([a1, a2].includes(b1) || [a1, a2].includes(b2)) continue;
    const pt = intersect(outer[a1], outer[a2], outer[b1], outer[b2]);
    if (!pt) continue;
    const k = Math.round(pt.x) + ',' + Math.round(pt.y);
    if (!seen[k]) seen[k] = { ...pt, d: new Set([i, j]) };
    else { seen[k].d.add(i); seen[k].d.add(j); }
  }
const inner: NodeT[] = Object.values(seen).map((p, i) => ({ id: 'I' + i, type: 'inner', x: p.x, y: p.y, diag: [...p.d] }));

export const NODES: NodeT[] = [...outer, ...inner];
export const NODE: Record<string, NodeT> = Object.fromEntries(NODES.map((n) => [n.id, n]));
export const NODE_IDS = NODES.map((n) => n.id);
const dist = (a: NodeT, b: NodeT) => Math.hypot(a.x - b.x, a.y - b.y);

export const EDGES: [string, string][] = [];
const JUMP: Record<string, Record<string, string>> = {};
const setJ = (a: string, b: string, c: string) => { (JUMP[a] = JUMP[a] || {})[b] = c; };
diagonals.forEach((d, i) => {
  const s = outer[d[0]], e = outer[d[1]];
  const on = [s, ...inner.filter((p) => p.diag!.includes(i)), e].sort((p, q) => dist(s, p) - dist(s, q));
  for (let k = 0; k < on.length - 1; k++) EDGES.push([on[k].id, on[k + 1].id]);
  for (let k = 0; k < on.length - 2; k++) { setJ(on[k].id, on[k + 1].id, on[k + 2].id); setJ(on[k + 2].id, on[k + 1].id, on[k].id); }
});
export const ADJ: Record<string, string[]> = {};
EDGES.forEach(([a, b]) => { (ADJ[a] = ADJ[a] || []).push(b); (ADJ[b] = ADJ[b] || []).push(a); });

/** Tigers start on the top tip and the crossing just below it. */
export const TIGER_START = ['O0', inner.find((p) => p.diag!.includes(3) && p.diag!.includes(4))!.id];

export function emptyBoard(): Board {
  const b: Board = {};
  NODE_IDS.forEach((id) => (b[id] = null));
  TIGER_START.forEach((id) => (b[id] = 'tiger'));
  return b;
}
export interface Move { to: string; capture?: string }
export function legalMoves(id: string, board: Board): Move[] {
  const out: Move[] = [], pc = board[id];
  ADJ[id].forEach((n) => {
    if (board[n] === null) out.push({ to: n });
    else if (pc === 'tiger' && board[n] === 'goat') {
      const l = JUMP[id]?.[n];
      if (l && board[l] === null) out.push({ to: l, capture: n });
    }
  });
  return out;
}
export const nodesOf = (b: Board, r: Role) => NODE_IDS.filter((i) => b[i] === r);
export const hasMove = (b: Board, r: Role) => nodesOf(b, r).some((i) => legalMoves(i, b).length > 0);

/** Pure rules engine: returns the Firestore patch for a move, or null if illegal. */
export function computeMove(g: GameDoc, role: Role, from: string | null, to: string, name: string): Partial<GameDoc> | null {
  if (g.status !== 'playing' || g.turn !== role) return null;
  const b = g.board;
  let patch: Partial<GameDoc>;
  if (role === 'goat' && g.phase === 'placement') {
    if (b[to] !== null) return null;
    const placed = g.goatsPlaced + 1;
    patch = { board: { ...b, [to]: 'goat' }, goatsPlaced: placed, phase: placed >= GOATS ? 'movement' : 'placement', turn: 'tiger', log: [{ text: `${name} placed a goat.` }] };
  } else {
    if (!from || b[from] !== role) return null;
    const mv = legalMoves(from, b).find((m) => m.to === to);
    if (!mv) return null;
    const nb: Board = { ...b, [to]: role, [from]: null };
    let cap = g.goatsCaptured, text = `${name} moved.`;
    if (mv.capture) { nb[mv.capture] = null; cap++; text = `${name} captured a goat!`; }
    patch = { board: nb, goatsCaptured: cap, turn: role === 'tiger' ? 'goat' : 'tiger', log: [{ text }] };
  }
  patch.turnCount = g.turnCount + 1;
  const phase = patch.phase ?? g.phase, nb = patch.board!, cap = patch.goatsCaptured ?? g.goatsCaptured;
  if (cap >= WIN_CAPTURES) Object.assign(patch, { status: 'finished', winner: 'tiger', winReason: '4 goats were captured.' });
  else if (patch.turn === 'tiger' && !hasMove(nb, 'tiger')) Object.assign(patch, { status: 'finished', winner: 'goat', winReason: 'Both tigers are completely blocked!' });
  else if (phase === 'movement' && patch.turn === 'goat' && !hasMove(nb, 'goat')) Object.assign(patch, { status: 'finished', winner: 'tiger', winReason: 'The goats have no moves left.' });
  return patch;
}
