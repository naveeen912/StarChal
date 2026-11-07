import { computeMove, emptyBoard, legalMoves, NODES, EDGES, TIGER_START, nodesOf } from './board';
import { GameDoc } from './types';
const P = (id: string, role: any) => ({ id, name: id, avatar: '🙂', role });
const fresh = (): GameDoc => ({ code: 'TEST', mode: 'private', createdAt: 0, host: P('h', 'goat'), guest: P('g', 'tiger'), status: 'playing', turn: 'goat', phase: 'placement', board: emptyBoard(), goatsPlaced: 0, goatsCaptured: 0, winner: null, winReason: null, log: [], turnCount: 0 });
console.log('nodes', NODES.length, 'edges', EDGES.length, 'tigers', TIGER_START);
const stats = { goat: 0, tiger: 0, plies: 0 };
for (let n = 0; n < 3000; n++) {
  let g = fresh(), guard = 0;
  while (g.status === 'playing' && guard++ < 400) {
    const role = g.turn;
    const opts: [string | null, string][] = [];
    if (role === 'goat' && g.phase === 'placement') NODES.forEach((x) => g.board[x.id] === null && opts.push([null, x.id]));
    else nodesOf(g.board, role).forEach((f) => legalMoves(f, g.board).forEach((m) => opts.push([f, m.to])));
    if (!opts.length) throw new Error('no options but game not finished');
    const [f, t] = opts[Math.floor(Math.random() * opts.length)];
    const patch = computeMove(g, role, f, t, role);
    if (!patch) throw new Error('legal option rejected');
    g = { ...g, ...patch } as GameDoc;
    const goats = Object.values(g.board).filter((v) => v === 'goat').length, tigers = Object.values(g.board).filter((v) => v === 'tiger').length;
    if (tigers !== 2 || goats !== g.goatsPlaced - g.goatsCaptured) throw new Error('invariant broken');
    stats.plies++;
  }
  if (g.status !== 'finished') throw new Error('game did not end');
  stats[g.winner!]++;
}
console.log('OK 3000 random games', stats);
