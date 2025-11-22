export interface BugStats {
  strength: number;
  attack: number;
  size: number;
  willingnessToLive: number;
  stamina: number;
  agility: number;
  quantity: number; // For swarms
}

export interface Bug {
  id: string;
  ownerId: string;
  ownerName: string;
  species: string;
  nickname?: string; // Optional nickname
  description: string;
  imageUrl: string;
  stats: BugStats;
  maxHp: number;
  currentHp: number;
  wins: number;
  losses: number;
  createdAt: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  password?: string; // Added for auth validation
  isVerified: boolean;
}

export interface BattleLog {
  log: string[];
  winnerId: string;
  damageDealtToWinner: number;
  damageDealtToLoser: number;
}

export enum AppView {
  AUTH = 'AUTH',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  DASHBOARD = 'DASHBOARD',
  UPLOAD = 'UPLOAD',
  MY_BUGS = 'MY_BUGS',
  BATTLE_ARENA = 'BATTLE_ARENA',
  HALL_OF_FAME = 'HALL_OF_FAME'
}