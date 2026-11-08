import { collection, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
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
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const created = await runTransaction(db!, async (tx) => {
      const ref = gref(code);
      if ((await tx.get(ref)).exists()) return false;
      tx.set(ref, newGame(code, 'private', me));
      return true;
    });
    if (created) return code;
  }
  throw new Error('Could not create a room. Please try again.');
}
export async function joinRoom(code: string, me: Player) {
  await runTransaction(db!, async (tx) => {
    const ref = gref(code), s = await tx.get(ref);
    if (!s.exists()) throw new Error('No room with that code.');
    const d = s.data() as GameDoc;
    if (d.host.id === me.id || d.guest?.id === me.id) return;
    if (d.guest || d.status !== 'waiting') throw new Error('That room is full.');
    tx.update(ref, { guest: me, status: 'role-select', log: [{ text: `${me.name} joined.` }] });
  });
}
export async function pickRole(g: GameDoc, me: string, role: Role) {
  if (g.code === 'LOCAL') {
    if (g.status !== 'role-select' || !g.guest || g.host.role === role || g.guest.role === role) return;
    const key = g.host.id === me ? 'host' : 'guest', other = key === 'host' ? 'guest' : 'host';
    const opp: Role = role === 'tiger' ? 'goat' : 'tiger';
    await pushPatch(g.code, {
      [key]: { ...g[key]!, role }, [other]: { ...g[other]!, role: opp }, status: 'playing',
      log: [{ text: `${g[key]!.name} chose ${role}s.` }],
    });
    return;
  }
  await runTransaction(db!, async (tx) => {
    const ref = gref(g.code), s = await tx.get(ref);
    if (!s.exists()) throw new Error('The game was closed.');
    const current = s.data() as GameDoc;
    if (current.status !== 'role-select' || !current.guest) return;
    const key = current.host.id === me ? 'host' : current.guest.id === me ? 'guest' : null;
    if (!key || current.host.role === role || current.guest.role === role) return;
    const other = key === 'host' ? 'guest' : 'host';
    const opponentRole: Role = role === 'tiger' ? 'goat' : 'tiger';
    tx.update(ref, {
      [key]: { ...current[key]!, role }, [other]: { ...current[other]!, role: opponentRole },
      status: 'playing', log: [{ text: `${current[key]!.name} chose ${role}s.` }],
    });
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
const MATCH_LEASE_MS = 45_000;
interface LobbyEntry { code: string; hostId: string; ts: number | Timestamp }
const isRecent = (entry: LobbyEntry) => Date.now() - (typeof entry.ts === 'number' ? entry.ts : entry.ts.toMillis()) < MATCH_LEASE_MS;

function startHosting(code: string, hostId: string, onError: (error: Error) => void) {
  stopHosting();
  let reportedError = false;
  hostTimer = setInterval(() => {
    void runTransaction(db!, async (tx) => {
      const ref = lobby(), s = await tx.get(ref);
      if (!s.exists()) return;
      const entry = s.data() as LobbyEntry;
      if (entry.code === code && entry.hostId === hostId) tx.update(ref, { ts: serverTimestamp() });
    }).then(() => { reportedError = false; }).catch((error: unknown) => {
      if (!reportedError) onError(error instanceof Error ? error : new Error(String(error)));
      reportedError = true;
    });
  }, 15_000);
}

export async function quickMatch(me: Player, onError: (error: Error) => void) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let result: { kind: 'host' | 'matched' | 'retry'; code?: string };
    const newCode = genCode();
    result = await runTransaction(db!, async (tx) => {
      const queueRef = lobby(), queueSnap = await tx.get(queueRef);
      const entry = queueSnap.exists() ? queueSnap.data() as LobbyEntry : null;
      if (entry?.code && entry.hostId !== me.id && isRecent(entry)) {
        const gameRef = gref(entry.code), gameSnap = await tx.get(gameRef);
        if (gameSnap.exists()) {
          const game = gameSnap.data() as GameDoc;
          if (game.host.id === entry.hostId && game.status === 'waiting' && !game.guest) {
            const hostRole: Role = Math.random() < 0.5 ? 'tiger' : 'goat';
            tx.update(gameRef, {
              host: { ...game.host, role: hostRole },
              guest: { ...me, role: hostRole === 'tiger' ? 'goat' : 'tiger' },
              status: 'playing', log: [{ text: 'Match found!' }],
            });
            tx.delete(queueRef);
            return { kind: 'matched', code: entry.code };
          }
        }
      } else if (entry?.code && entry.hostId === me.id && isRecent(entry)) {
        const gameRef = gref(entry.code), gameSnap = await tx.get(gameRef);
        if (gameSnap.exists()) {
          const game = gameSnap.data() as GameDoc;
          if (game.host.id === me.id && game.status === 'waiting' && !game.guest)
            return { kind: 'host', code: entry.code };
        }
      }

      const gameRef = gref(newCode), gameSnap = await tx.get(gameRef);
      if (gameSnap.exists()) return { kind: 'retry' };
      tx.set(gameRef, newGame(newCode, 'quick', me));
      tx.set(queueRef, { code: newCode, hostId: me.id, ts: serverTimestamp() });
      return { kind: 'host', code: newCode };
    });

    if (result.kind === 'retry') continue;
    if (!result.code) continue;
    if (result.kind === 'host') startHosting(result.code, me.id, onError);
    return result.code;
  }
  return null;
}
export async function cancelWaiting(g: GameDoc | null, me: string) {
  stopHosting();
  if (!g || g.mode === 'local' || g.status !== 'waiting' || g.host.id !== me || !isConfigured) return;
  await runTransaction(db!, async (tx) => {
    const gameRef = gref(g.code), queueRef = lobby();
    const [gameSnap, queueSnap] = await Promise.all([tx.get(gameRef), tx.get(queueRef)]);
    if (queueSnap.exists()) {
      const entry = queueSnap.data() as LobbyEntry;
      if (entry.code === g.code && entry.hostId === me) tx.delete(queueRef);
    }
    if (gameSnap.exists()) {
      const game = gameSnap.data() as GameDoc;
      if (game.host.id === me && game.status === 'waiting' && !game.guest) tx.delete(gameRef);
    }
  });
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
