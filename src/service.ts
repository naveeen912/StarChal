import { collection, deleteDoc, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import { readLocalGame, readLocalProfile, subscribeLocalGame, writeLocalGame } from './local';
import { emptyBoard } from './game/board';
import { GameDoc, Player, Role } from './game/types';

export const gref = (c: string) => doc(db!, 'games', c);
export const genCode = () => { const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c = ''; for (let i = 0; i < 4; i++) c += L[Math.floor(Math.random() * L.length)]; return c; };
export const newGame = (code: string, mode: GameDoc['mode'], host: Player): GameDoc => ({
  code, mode, createdAt: Date.now(), host, guest: null, status: 'waiting', turn: 'goat', phase: 'placement',
  board: emptyBoard(), goatsPlaced: 0, goatsCaptured: 0, winner: null, winReason: null, log: [], turnCount: 0,
});
export const subscribeGame = (code: string, cb: (g: GameDoc | null) => void, onErr: (e: Error) => void) =>
  code === 'LOCAL' ? subscribeLocalGame(cb) : onSnapshot(gref(code), (s) => cb(s.exists() ? (s.data() as GameDoc) : null), onErr);

export async function createLocalGame(me: Player) {
  writeLocalGame({ ...newGame('LOCAL', 'local', me), status: 'role-select',
    guest: { id: 'local-guest', name: 'Player 2', avatar: '🐯', role: null } });
  return 'LOCAL';
}

export async function createRoom(me: Player) {
  const code = genCode();
  await setDoc(gref(code), newGame(code, 'private', me));
  return code;
}
export async function joinRoom(code: string, me: Player) {
  const s = await getDoc(gref(code));
  if (!s.exists()) throw new Error('No room with that code.');
  const d = s.data() as GameDoc;
  if (d.host.id === me.id || d.guest?.id === me.id) return;
  if (d.guest) throw new Error('That room is full.');
  await updateDoc(gref(code), { guest: me, status: 'role-select', log: [{ text: `${me.name} joined.` }] });
}
export async function pickRole(g: GameDoc, me: string, role: Role) {
  if (g.status !== 'role-select' || !g.guest) return;
  if (g.host.role === role || g.guest.role === role) return;
  const key = g.host.id === me ? 'host' : 'guest', other = key === 'host' ? 'guest' : 'host';
  const opp: Role = role === 'tiger' ? 'goat' : 'tiger';
  await pushPatch(g.code, {
    [key]: { ...g[key]!, role }, [other]: { ...g[other]!, role: opp }, status: 'playing',
    log: [{ text: `${g[key]!.name} chose ${role}s.` }],
  });
}
export async function pushPatch(code: string, patch: Partial<GameDoc>) {
  if (code !== 'LOCAL') return updateDoc(gref(code), patch as any);
  const game = readLocalGame();
  if (!game) throw new Error('No local game to update.');
  writeLocalGame({ ...game, ...patch });
}
export async function resign(g: GameDoc, me: string) {
  const mine = g.host.id === me ? g.host.role : g.guest?.role;
  if (!mine) return;
  await pushPatch(g.code, { status: 'finished', winner: mine === 'tiger' ? 'goat' : 'tiger', winReason: 'Opponent resigned.' });
}
export async function rematch(g: GameDoc) {
  const sw = (r: Role | null): Role => (r === 'tiger' ? 'goat' : 'tiger');
  await pushPatch(g.code, {
    status: 'playing', turn: 'goat', phase: 'placement', board: emptyBoard(), goatsPlaced: 0, goatsCaptured: 0,
    winner: null, winReason: null, turnCount: 0, host: { ...g.host, role: sw(g.host.role) }, guest: { ...g.guest!, role: sw(g.guest!.role) },
    log: [{ text: 'Rematch! Sides swapped.' }],
  });
}

/* ---------- worldwide quick match ---------- */
let hostTimer: ReturnType<typeof setInterval> | null = null;
export const stopHosting = () => { if (hostTimer) clearInterval(hostTimer); hostTimer = null; };
const lobby = () => doc(db!, 'lobby', 'waiting');

export async function quickMatch(me: Player): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = { join: null as string | null, host: null as string | null };
    await runTransaction(db!, async (tx) => {
      r.join = null; r.host = null;
      const s = await tx.get(lobby());
      const d = s.exists() ? (s.data() as any) : null;
      if (d && d.code && Date.now() - d.ts < 45000 && d.hostId !== me.id) { r.join = d.code; tx.delete(lobby()); }
      else { r.host = genCode(); tx.set(lobby(), { code: r.host, hostId: me.id, ts: Date.now() }); }
    });
    if (r.host) {
      const code = r.host;
      await setDoc(gref(code), newGame(code, 'quick', me));
      hostTimer = setInterval(async () => {
        try { const s = await getDoc(lobby()); if (s.exists() && (s.data() as any).hostId === me.id) await setDoc(lobby(), { code, hostId: me.id, ts: Date.now() }); } catch {}
      }, 15000);
      return code;
    }
    for (let i = 0; i < 8; i++) {
      const s = await getDoc(gref(r.join!));
      const d = s.exists() ? (s.data() as GameDoc) : null;
      if (d && !d.guest && d.status === 'waiting') {
        const hr: Role = Math.random() < 0.5 ? 'tiger' : 'goat';
        try {
          await updateDoc(gref(r.join!), { host: { ...d.host, role: hr }, guest: { ...me, role: hr === 'tiger' ? 'goat' : 'tiger' }, status: 'playing', log: [{ text: 'Match found!' }] });
          return r.join!;
        } catch { break; }
      }
      await new Promise((res) => setTimeout(res, 450));
    }
  }
  return null;
}
export async function cancelWaiting(g: GameDoc | null, me: string) {
  stopHosting();
  if (!g || g.mode === 'local' || g.status !== 'waiting' || g.host.id !== me) return;
  try {
    const s = await getDoc(lobby());
    if (s.exists() && (s.data() as any).code === g.code) await deleteDoc(lobby());
    await deleteDoc(gref(g.code));
  } catch {}
}

/* ---------- profile + leaderboard ---------- */
export const saveProfile = async (uid: string, name: string, avatar: string) => {
  if (!isConfigured) { localStorage.setItem('sc_profile', JSON.stringify({ ...readLocalProfile(), name, avatar })); return; }
  await setDoc(doc(db!, 'users', uid), { name, avatar }, { merge: true });
};
export async function loadStats(uid: string) {
  if (!isConfigured) { const { wins, played } = readLocalProfile(); return { wins, played }; }
  const s = await getDoc(doc(db!, 'users', uid));
  return s.exists() ? { wins: (s.data() as any).wins || 0, played: (s.data() as any).played || 0 } : { wins: 0, played: 0 };
}
export const recordResult = (uid: string, name: string, avatar: string, won: boolean) =>
  setDoc(doc(db!, 'users', uid), { name, avatar, wins: increment(won ? 1 : 0), played: increment(1) }, { merge: true });
export async function topPlayers() {
  if (!isConfigured) return [];
  const q = await getDocs(query(collection(db!, 'users'), orderBy('wins', 'desc'), limit(10)));
  return q.docs.map((d) => d.data() as { name: string; avatar: string; wins: number }).filter((u) => u.wins > 0);
}
