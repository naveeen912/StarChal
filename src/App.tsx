import { useCallback, useEffect, useRef, useState } from 'react';
import { Starfield } from './components/Starfield';
import { EndScreen, GameScreen, HomeScreen, ProfileScreen, RoleScreen, RulesScreen, WaitScreen } from './screens';
import { ensureAuth, isConfigured } from './firebase';
import { GameDoc, Player, Profile } from './game/types';
import * as svc from './service';

const EMPTY: Profile = { name: '', avatar: '🦁', wins: 0, played: 0 };
const invite = (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 4);

export default function App() {
  const [ready, setReady] = useState(false), [uid, setUid] = useState(''), [editing, setEditing] = useState(false), [rules, setRules] = useState(false);
  const [profile, setProfile] = useState<Profile>(() => { try { return { ...EMPTY, ...JSON.parse(localStorage.getItem('sc_profile') || '{}') }; } catch { return EMPTY; } });
  const [error, setError] = useState(''), [code, setCode] = useState<string | null>(null), [game, setGame] = useState<GameDoc | null>(null), [searching, setSearching] = useState(false);
  const [board, setBoard] = useState<{ name: string; avatar: string; wins: number }[]>([]);
  const counted = useRef(''), gameRef = useRef<GameDoc | null>(null), joined = useRef(false);
  gameRef.current = game;

  const me = useCallback((): Player => ({ id: uid, name: profile.name, avatar: profile.avatar, role: null }), [uid, profile]);
  const refresh = useCallback(async (id = uid) => {
    try { const s = await svc.loadStats(id); setProfile((p) => ({ ...p, ...s })); setBoard(await svc.topPlayers()); } catch { /* offline */ }
  }, [uid]);
  const guard = async (fn: () => Promise<void>) => { try { setError(''); await fn(); } catch (e: any) { setError(e.message || 'Something went wrong.'); setSearching(false); } };
  const enter = (c: string) => { setError(''); setCode(c); localStorage.setItem('sc_last', c); history.replaceState(null, '', location.pathname); };

  useEffect(() => {
    (async () => {
      try {
        const id = await ensureAuth(); setUid(id);
        if (profile.name) { await refresh(id); const last = localStorage.getItem('sc_last'); if (last && (!invite || !isConfigured) && (isConfigured || last === 'LOCAL')) setCode(last); }
      } catch (e: any) { setError('Could not connect: ' + e.message); }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!code) { setGame(null); return; }
    return svc.subscribeGame(code, (g) => {
      if (!g) { setCode(null); setGame(null); setSearching(false); setError('The game was closed.'); localStorage.removeItem('sc_last'); return; }
      setGame(g);
    }, (e) => setError('Connection lost: ' + e.message));
  }, [code]);

  useEffect(() => { if (game && game.status !== 'waiting') { svc.stopHosting(); setSearching(false); } }, [game?.status]);

  useEffect(() => {
    if (!game || game.mode === 'local' || game.status !== 'finished') return;
    const key = `${game.code}:${game.createdAt}:${game.winner}:${game.winReason}`;
    if (counted.current === key) return; counted.current = key;
    const myRole = game.host.id === uid ? game.host.role : game.guest?.role;
    svc.recordResult(uid, profile.name, profile.avatar, myRole === game.winner).then(() => refresh()).catch(() => {});
    localStorage.removeItem('sc_last');
  }, [game?.status, game?.winReason]);

  // opened via an invite link (?room=ABCD): join automatically once the profile exists
  useEffect(() => {
    if (!isConfigured || !invite || joined.current || !uid || !profile.name || code) return;
    joined.current = true;
    guard(async () => { await svc.joinRoom(invite, me()); enter(invite); });
  }, [uid, profile.name]);

  const home = async () => {
    await svc.cancelWaiting(gameRef.current, uid);
    setCode(null); setGame(null); setSearching(false); setRules(false); localStorage.removeItem('sc_last'); refresh();
  };
  const saveProf = (name: string, avatar: string) => {
    const p = { ...profile, name, avatar }; setProfile(p); localStorage.setItem('sc_profile', JSON.stringify(p));
    guard(async () => { await svc.saveProfile(uid, name, avatar); setEditing(false); refresh(); });
  };

  let view: React.ReactNode = null;
  if (!ready) view = <div className="col"><p className="tag">Loading…</p></div>;
  else if (!profile.name || editing || !uid) view = <ProfileScreen initial={profile} onDone={saveProf} error={error} />;
  else if (rules) view = <RulesScreen onClose={() => setRules(false)} />;
  else if (searching && !game) view = <WaitScreen title="Searching worldwide…" sub="Looking for an opponent anywhere on Earth." onCancel={home} />;
  else if (game?.status === 'waiting') view = <WaitScreen title={game.mode === 'quick' ? 'Searching worldwide…' : 'Room created'} code={game.mode === 'private' ? game.code : undefined}
    sub={game.mode === 'private' ? 'Share this code or link. Your friend opens it on their own device.' : 'Looking for an opponent anywhere on Earth.'} onCancel={home} />;
  else if (game?.status === 'role-select') view = <RoleScreen game={game} onPick={(r) => guard(() => svc.pickRole(game, uid, r))} />;
  else if (game?.status === 'playing') view = <GameScreen game={game} uid={uid} onRules={() => setRules(true)}
    onResign={() => { if (confirm('Resign this game? You will lose.')) guard(() => svc.resign(game, game.mode === 'local' ? (game.host.role === game.turn ? game.host.id : game.guest!.id) : uid)); }} />;
  else if (game?.status === 'finished') view = <EndScreen game={game} uid={uid} onRematch={() => guard(() => svc.rematch(game))} onHome={home} />;
  else view = <HomeScreen profile={profile} board={board} error={error} initialCode={isConfigured ? invite : ''} onLocal={() => guard(async () => { enter(await svc.createLocalGame(me())); })}
    onQuick={() => guard(async () => { setSearching(true); const c = await svc.quickMatch(me()); if (!c) throw new Error('No match found, try again.'); enter(c); })}
    onCreate={() => guard(async () => { enter(await svc.createRoom(me())); })}
    onJoin={(c) => guard(async () => { if (c.length !== 4) throw new Error('Enter the 4-letter code.'); await svc.joinRoom(c, me()); enter(c); })}
    onEdit={() => setEditing(true)} onRules={() => setRules(true)} />;

  return (<><Starfield /><main className={'app' + (game?.status === 'playing' ? ' playing' : '')}>{view}</main></>);
}
