import { useEffect, useState } from 'react';
import { BoardView } from './components/Board';
import { GoatIcon, TigerIcon } from './components/Icons';
import { Btn, Card, Confetti, Err, Logo, ShareButton } from './ui';
import { GOATS, WIN_CAPTURES, computeMove } from './game/board';
import { GameDoc, Profile, Role } from './game/types';
import { pushPatch } from './service';
import { isConfigured } from './firebase';
import { buzz, setSound, sfx, soundOn } from './audio';

export const AVATARS = ['🦁', '🐘', '🦅', '🐼', '🦊', '🐺', '🦉', '🐲'];

export function ProfileScreen({ initial, onDone, error }: { initial: Profile; onDone: (n: string, a: string) => void; error: string }) {
  const [name, setName] = useState(initial.name), [av, setAv] = useState(initial.avatar), [e, setE] = useState('');
  const submit = () => (name.trim().length < 2 ? setE('Enter a name (2+ letters).') : onDone(name.trim(), av));
  return (
    <div className="col">
      <Logo /><p className="tag">Tigers vs Goats · {isConfigured ? 'played across the world' : 'play on this device'}</p>
      <Card>
        <h2>Create your profile</h2><p className="sub">Pick a name and an avatar. {isConfigured ? 'Opponents everywhere will see them.' : 'Pass the device between turns to play with a friend.'}</p>
        <input className="input" value={name} maxLength={16} placeholder="Your name" aria-label="Your name" autoComplete="nickname"
          onChange={(ev) => setName(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && submit()} />
        <div className="avatars" role="radiogroup" aria-label="Avatar">
          {AVATARS.map((a) => <button key={a} type="button" role="radio" aria-checked={a === av} className={'av' + (a === av ? ' sel' : '')} onClick={() => { sfx.tap(); setAv(a); }}>{a}</button>)}
        </div>
        <Btn kind="gold" onClick={submit}>Let's play</Btn><Err text={e || error} />
      </Card>
    </div>
  );
}

export function HomeScreen(p: { profile: Profile; board: { name: string; avatar: string; wins: number }[]; error: string; initialCode: string;
  onLocal: () => void; onQuick: () => void; onCreate: () => void; onJoin: (c: string) => void; onEdit: () => void; onRules: () => void }) {
  const [joining, setJoining] = useState(!!p.initialCode), [code, setCode] = useState(p.initialCode), [snd, setSnd] = useState(soundOn());
  return (
    <div className="home">
      <div className="home-head"><Logo /></div>
      <Card className="me">
        <span className="big-av">{p.profile.avatar}</span>
        <div className="grow"><b>{p.profile.name}</b><small>{p.profile.wins} wins · {p.profile.played} games</small></div>
        <button type="button" className="link" onClick={p.onEdit}>Edit</button>
      </Card>
      <div className="actions-col">
        <Btn kind="gold" onClick={p.onLocal}>👥 Play on this device</Btn>
        {!isConfigured && <p className="sub">Two players · take turns on the same device. Your game is saved in this browser.</p>}
        {isConfigured && <>
        <Btn kind="gold" className="quick" onClick={p.onQuick}>⚡ Quick Match — play anyone, worldwide</Btn>
        <div className="row"><Btn onClick={p.onCreate}>👥 Create room</Btn><Btn onClick={() => setJoining((j) => !j)}>🔑 Join room</Btn></div>
        {joining && <Card>
          <input className="input code-in" value={code} maxLength={4} placeholder="ABCD" aria-label="Room code" autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && p.onJoin(code)} />
          <Btn kind="gold" onClick={() => p.onJoin(code)}>Join</Btn>
        </Card>}
        </>}
        <Err text={p.error} />
        <div className="row"><Btn onClick={p.onRules}>How to play</Btn><Btn onClick={() => { setSound(!snd); setSnd(!snd); }}>{snd ? '🔊 Sound on' : '🔇 Sound off'}</Btn></div>
      </div>
      {isConfigured && <Card className="lb-card"><h2>🏆 Top players</h2>
        {p.board.length === 0 ? <p className="sub">No champions yet — be the first!</p> : p.board.map((u, i) => (
          <div key={i} className="lb"><span className="rk">{i + 1}</span><span>{u.avatar}</span><span className="nm">{u.name}</span><span className="wn">{u.wins} wins</span></div>))}
      </Card>}
    </div>
  );
}

export function WaitScreen({ title, code, sub, error, onCancel }: { title: string; code?: string; sub: string; error?: string; onCancel: () => void }) {
  return (
    <div className="col">
      <Logo />
      <Card className="center">
        <h2>{title}</h2>
        {code && <div className="code" aria-label={`Room code ${code.split('').join(' ')}`}>{code}</div>}
        <div className="radar" aria-hidden="true"><i /></div>
        <p className="sub">{sub}</p>
        {code && <ShareButton code={code} />}
        <Err text={error || ''} />
        <Btn onClick={onCancel}>Cancel</Btn>
      </Card>
    </div>
  );
}

export function RoleScreen({ game, onPick }: { game: GameDoc; onPick: (r: Role) => void }) {
  const taken = (r: Role) => game.host.role === r || game.guest?.role === r;
  return (
    <div className="col">
      <Logo />
      <Card><h2>Choose your side</h2>
        <p className="sub">{game.host.avatar} {game.host.name} vs {game.guest?.avatar} {game.guest?.name} — first to tap picks.</p>
        <div className="roles">
          <button type="button" className="role" disabled={taken('tiger')} onClick={() => onPick('tiger')}><TigerIcon className="role-ic" /><h3>Tigers</h3><p>Capture {WIN_CAPTURES} goats to win.</p></button>
          <button type="button" className="role" disabled={taken('goat')} onClick={() => onPick('goat')}><GoatIcon className="role-ic" /><h3>Goats</h3><p>Place {GOATS}, then trap both tigers.</p></button>
        </div>
      </Card>
    </div>
  );
}

export function GameScreen({ game, uid, onResign, onRules }: { game: GameDoc; uid: string; onResign: () => void; onRules: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const me = game.mode === 'local' ? (game.host.role === game.turn ? game.host : game.guest!) : game.host.id === uid ? game.host : game.guest!;
  const myRole = me.role!, mine = game.turn === myRole && game.status === 'playing';
  const nameOf = (r: Role) => (game.host.role === r ? game.host : game.guest!);
  const placing = mine && myRole === 'goat' && game.phase === 'placement';
  useEffect(() => { setSel(null); if (mine) sfx.turn(); }, [game.turnCount, mine]);

  const onNode = (id: string) => {
    if (!mine) return;
    if (placing) { const p = computeMove(game, myRole, null, id, me.name); if (p) pushPatch(game.code, p).catch(() => {}); return; }
    if (sel === id) return setSel(null);
    if (!sel) { if (game.board[id] === myRole) { sfx.tap(); setSel(id); } return; }
    const p = computeMove(game, myRole, sel, id, me.name);
    if (p) { setSel(null); pushPatch(game.code, p).catch(() => {}); }
    else if (game.board[id] === myRole) { sfx.tap(); setSel(id); }
  };
  const Chip = ({ r }: { r: Role }) => {
    const pl = nameOf(r);
    return (
      <div className={'chip' + (game.turn === r ? ' on' : '')} aria-current={game.turn === r}>
        <span className="chip-av">{pl.avatar}</span>
        <div className="grow"><div className="chip-name">{pl.name}{game.mode !== 'local' && pl.id === uid ? ' (you)' : ''}</div>
          <div className="dots" aria-label={r === 'goat' ? `${GOATS - game.goatsPlaced} goats left to place` : `${game.goatsCaptured} of ${WIN_CAPTURES} goats captured`}>
            {r === 'goat' ? Array.from({ length: GOATS }, (_, i) => <i key={i} className={i >= game.goatsPlaced ? 'f' : ''} />)
              : Array.from({ length: WIN_CAPTURES }, (_, i) => <i key={i} className={i < game.goatsCaptured ? 'r' : ''} />)}
          </div></div>
        {r === 'goat' ? <GoatIcon className="chip-ic" /> : <TigerIcon className="chip-ic" />}
      </div>);
  };
  const what = game.turn === 'goat' ? (game.phase === 'placement' ? 'place a goat' : 'move a goat') : 'move or capture';
  return (
    <div className="game">
      <div className="players"><Chip r="goat" /><Chip r="tiger" /></div>
      <div className="stage">
        <div className={'banner' + (mine ? ' mine' : '')} aria-live="polite">{mine ? `${game.mode === 'local' ? nameOf(game.turn).name : 'Your turn'} — ${what}` : `${nameOf(game.turn).name}'s turn…`}
          <small>{game.phase === 'placement' ? `Placement · ${GOATS - game.goatsPlaced} goats left` : 'Movement phase'}</small></div>
        <BoardView board={game.board} turnCount={game.turnCount} selected={sel} canPlace={placing} onNode={onNode} />
        <p className="log" aria-live="polite">{game.log?.[0]?.text ?? ''}</p>
      </div>
      <div className="side-actions"><Btn onClick={onRules}>How to play</Btn><Btn onClick={onResign}>Resign</Btn></div>
    </div>
  );
}

export function EndScreen({ game, uid, onRematch, onHome }: { game: GameDoc; uid: string; onRematch: () => void; onHome: () => void }) {
  const myRole = game.host.id === uid ? game.host.role : game.guest?.role, won = game.mode === 'local' || myRole === game.winner;
  const w = game.winner!, wp = game.host.role === w ? game.host : game.guest!;
  useEffect(() => { (won ? sfx.win : sfx.lose)(); if (won) buzz([60, 40, 60]); }, []);
  return (
    <div className="col">
      {won && <Confetti />}<Logo />
      <Card className="center">
        {w === 'tiger' ? <TigerIcon className="end-ic" /> : <GoatIcon className="end-ic" />}
        <h2 className="end-title">{game.mode === 'local' ? `${wp.name} wins! 🎉` : won ? 'Victory! 🎉' : 'Defeat'}</h2>
        <p className="sub">{wp.name} ({w === 'tiger' ? 'Tigers' : 'Goats'}) won — {game.winReason}</p>
        <div className="row"><Btn kind="gold" onClick={onRematch}>Rematch</Btn><Btn onClick={onHome}>Home</Btn></div>
      </Card>
    </div>
  );
}

export function RulesScreen({ onClose }: { onClose: () => void }) {
  return (
    <div className="col"><Logo />
      <Card><h2>How to play</h2>
        <div className="rules">
          <p><b>Board:</b> a five-point star with 10 points joined by lines.</p>
          <p><b>Tigers</b> start on the top tip and the crossing just below it. They move one step along a line, or <b>jump</b> a goat in a straight line onto an empty point to capture it.</p>
          <p><b>Goats</b> go first. Place one goat per turn ({GOATS} total) — tigers move in between. After all are down, goats slide one step along a line.</p>
          <p><b>Goats win</b> when both tigers are completely blocked. <b>Tigers win</b> by capturing {WIN_CAPTURES} goats (or if the goats can't move).</p>
        </div>
        <Btn kind="gold" onClick={onClose}>Got it</Btn></Card>
    </div>
  );
}
