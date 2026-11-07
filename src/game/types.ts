export type Role = 'tiger' | 'goat';
export type Board = Record<string, Role | null>;
export interface Player { id: string; name: string; avatar: string; role: Role | null }
export type Status = 'waiting' | 'role-select' | 'playing' | 'finished';
export interface GameDoc {
  code: string; mode: 'quick' | 'private' | 'local'; createdAt: number;
  host: Player; guest: Player | null; status: Status;
  turn: Role; phase: 'placement' | 'movement'; board: Board;
  goatsPlaced: number; goatsCaptured: number;
  winner: Role | null; winReason: string | null;
  log: { text: string }[]; turnCount: number;
}
export interface Profile { name: string; avatar: string; wins: number; played: number }
