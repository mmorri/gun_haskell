import type { EnemyDef, EnemyKind, TargetMode, TowerDef, TowerKind, Vec } from "./config";

export interface Enemy {
  id: number;
  kind: EnemyKind;
  def: EnemyDef;
  pos: Vec;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  speed: number;
  armor: number;
  reward: number;
  radius: number;
  wp: number;
  travelled: number;
  slowT: number;
  slowFactor: number;
  flash: number;
  alive: boolean;
  boss: boolean;
}

export interface Tower {
  id: number;
  kind: TowerKind;
  def: TowerDef;
  pos: Vec;
  level: number;
  cd: number;
  spent: number;
  target: TargetMode;
  angle: number;
  recoil: number;
  kills: number;
}

export interface Bullet {
  id: number;
  ownerId: number;
  kind: "bullet" | "shell" | "frost";
  def: TowerDef;
  pos: Vec;
  prev: Vec;
  vel: Vec;
  speed: number;
  damage: number;
  life: number;
  splash: number;
  slowFactor: number;
  slowDur: number;
  alive: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  shape: "circle" | "spark" | "ring";
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface Beam {
  pts: Vec[];
  color: string;
  life: number;
  maxLife: number;
  width: number;
  chain: boolean;
}

export type Phase = "shop" | "combat" | "gameover";

export interface RunStats {
  kills: number;
  leaks: number;
  spent: number;
  built: Set<TowerKind>;
  maxed: boolean;
  bossKilled: boolean;
  cashEarned: number;
}

export interface Game {
  phase: Phase;
  paused: boolean;
  wave: number;
  cash: number;
  lives: number;
  maxLives: number;
  towers: Tower[];
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  texts: FloatText[];
  beams: Beam[];
  queue: EnemyKind[];
  queueTotal: number;
  spawned: number;
  spawnTimer: number;
  spawnInterval: number;
  time: number;
  speed: number;
  shake: number;
  flash: number;
  placing: TowerKind | null;
  selected: number | null;
  hover: Vec | null;
  mouse: Vec;
  nextId: number;
  stats: RunStats;
  damageMult: number;
  cashMult: number;
  startCash: number;
  startLives: number;
  waveBanked: number;
  banner: { text: string; sub: string; life: number; maxLife: number } | null;
  bossWave: boolean;
  rng: () => number;
  onEvent?: (name: string) => void;
}

export interface SaveData {
  v: number;
  bestWave: number;
  bestKills: number;
  teeth: number;
  meta: Record<string, number>;
  achievements: string[];
  settings: { muted: boolean; music: boolean; reducedMotion: boolean };
  runs: number;
}
