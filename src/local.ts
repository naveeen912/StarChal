import { GameDoc, Profile } from './game/types';

const GAME_KEY = 'sc_local_game';
const listeners = new Set<(game: GameDoc | null) => void>();
export function readLocalGame(): GameDoc | null {
  try { return JSON.parse(localStorage.getItem(GAME_KEY) || 'null'); } catch { return null; }
}
export function writeLocalGame(game: GameDoc) {
  localStorage.setItem(GAME_KEY, JSON.stringify(game));
  listeners.forEach((cb) => cb(game));
}
export function subscribeLocalGame(cb: (game: GameDoc | null) => void) {
  listeners.add(cb);
  cb(readLocalGame());
  const onStorage = (event: StorageEvent) => { if (event.key === GAME_KEY) cb(readLocalGame()); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}
export function readLocalProfile(): Profile {
  try { return { name: '', avatar: '🦁', wins: 0, played: 0, ...JSON.parse(localStorage.getItem('sc_profile') || '{}') }; }
  catch { return { name: '', avatar: '🦁', wins: 0, played: 0 }; }
}
