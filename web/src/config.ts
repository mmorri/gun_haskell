// ---------------------------------------------------------------------------
// Pew-Pew Defense Deluxe - balance, layout and content tables
// ---------------------------------------------------------------------------

export const W = 1280;
export const H = 720;
export const HUD_H = 64;
export const GRID = 40;

export const BOARD = { x: 10, y: 74, w: 920, h: 640 };
export const SIDEBAR = { x: 940, y: 64, w: 340, h: 656 };

export interface Vec {
  x: number;
  y: number;
}

// The gremlin conga line, from the hole (offscreen left) to the crystal.
export const PATH: Vec[] = [
  { x: 52, y: 180 },
  { x: 200, y: 180 },
  { x: 200, y: 470 },
  { x: 480, y: 470 },
  { x: 480, y: 200 },
  { x: 720, y: 200 },
  { x: 720, y: 570 },
  { x: 880, y: 570 },
];

export const PATH_WIDTH = 46;
export const BASE_POS: Vec = PATH[PATH.length - 1];
export const PORTAL_POS: Vec = PATH[0];

export const START_CASH = 150;
export const START_LIVES = 20;
export const SELL_RATE = 0.6;

// ---------------------------------------------------------------------------
// Towers
// ---------------------------------------------------------------------------

export type TowerKind = "pew" | "nanny" | "brrrt" | "yeet" | "frost" | "tesla";

export interface TowerDef {
  kind: TowerKind;
  name: string;
  short: string;
  cost: number;
  range: number;
  cd: number;
  damage: number;
  projectile: "bullet" | "shell" | "beam" | "chain" | "frost";
  projSpeed: number;
  splash?: number;
  slowFactor?: number;
  slowDur?: number;
  chain?: number;
  color: string;
  accent: string;
  blurb: string;
  desc: string;
  sprite: "pew" | "nanny" | "brrrt" | "yeet" | "vector";
  hotkey: string;
}

export const TOWERS: TowerDef[] = [
  {
    kind: "pew",
    name: "Pew-Pew Turret",
    short: "Pew-Pew",
    cost: 50,
    range: 120,
    cd: 0.72,
    damage: 10,
    projectile: "bullet",
    projSpeed: 720,
    color: "#7fe7ff",
    accent: "#2a9fc4",
    blurb: "reliable, like socks",
    desc: "Cheap, cheerful, and always invited to the party. Balanced all-rounder.",
    sprite: "pew",
    hotkey: "1",
  },
  {
    kind: "brrrt",
    name: "BRRRT Machine",
    short: "BRRRT",
    cost: 90,
    range: 105,
    cd: 0.2,
    damage: 5,
    projectile: "bullet",
    projSpeed: 820,
    color: "#ffd166",
    accent: "#c98f1c",
    blurb: "caffeine incarnate",
    desc: "Sprays a river of tiny bullets. Short range, enormous attitude.",
    sprite: "brrrt",
    hotkey: "2",
  },
  {
    kind: "nanny",
    name: "No-Scope Nanny",
    short: "Nanny",
    cost: 110,
    range: 240,
    cd: 2.0,
    damage: 40,
    projectile: "beam",
    projSpeed: 0,
    color: "#ff9fb2",
    accent: "#c05a72",
    blurb: "360 no-scope granny",
    desc: "Instant-hit sniper with huge range. Speaks softly, deletes loudly.",
    sprite: "nanny",
    hotkey: "3",
  },
  {
    kind: "yeet",
    name: "YEET Cannon",
    short: "YEET",
    cost: 160,
    range: 170,
    cd: 1.8,
    damage: 40,
    projectile: "shell",
    projSpeed: 420,
    splash: 72,
    color: "#ff8c42",
    accent: "#b8521b",
    blurb: "diplomatic solution",
    desc: "Lobs an explosive opinion. Damages everything in the blast radius.",
    sprite: "yeet",
    hotkey: "4",
  },
  {
    kind: "frost",
    name: "Frosty Boi",
    short: "Frosty",
    cost: 70,
    range: 110,
    cd: 1.05,
    damage: 3,
    projectile: "frost",
    projSpeed: 520,
    slowFactor: 0.45,
    slowDur: 1.5,
    color: "#9be7ff",
    accent: "#3d7fa8",
    blurb: "emotional cold shoulder",
    desc: "Chills enemies to 55% speed. Does almost no damage, ruins everyone's day.",
    sprite: "vector",
    hotkey: "5",
  },
  {
    kind: "tesla",
    name: "Tesla Coil",
    short: "Tesla",
    cost: 200,
    range: 155,
    cd: 1.25,
    damage: 18,
    projectile: "chain",
    projSpeed: 0,
    chain: 3,
    color: "#c9a7ff",
    accent: "#7b4fd0",
    blurb: "shocking, honestly",
    desc: "Arcs lightning between up to 4 enemies. Expensive, dramatic, worth it.",
    sprite: "vector",
    hotkey: "6",
  },
];

export const TOWER_BY_KIND = Object.fromEntries(TOWERS.map((t) => [t.kind, t])) as Record<TowerKind, TowerDef>;

export function upgradeCost(t: { def: TowerDef; level: number; spent: number }): number {
  return Math.round(t.def.cost * (t.level === 1 ? 0.9 : 1.5));
}

export const MAX_LEVEL = 3;

// ---------------------------------------------------------------------------
// Superpowers
// ---------------------------------------------------------------------------

export type SuperId = "a10" | "marines";

export interface SuperDef {
  id: SuperId;
  name: string;
  short: string;
  desc: string;
  hint: string;
  cooldown: number;
  color: string;
  accent: string;
  hotkey: string;
}

export const SUPERS: SuperDef[] = [
  {
    id: "a10",
    name: "A-10 Warthog",
    short: "A-10",
    desc: "Draw a strafing line. The plane handles the rest.",
    hint: "click a start point, then an end point",
    cooldown: 38,
    color: "#ffe27a",
    accent: "#c99a1c",
    hotkey: "Q",
  },
  {
    id: "marines",
    name: "Marine Drop",
    short: "Marines",
    desc: "Drop 5 marines with 5 seconds of absurd fire rate.",
    hint: "click a drop point",
    cooldown: 44,
    color: "#7fffd4",
    accent: "#25a97c",
    hotkey: "E",
  },
];

export const SUPER_BY_ID = Object.fromEntries(SUPERS.map((s) => [s.id, s])) as Record<SuperId, SuperDef>;

export const A10 = {
  speed: 640,
  damage: 230,
  radius: 54,
  margin: 280,
  tick: 0.055,
};

export const MARINES = {
  count: 5,
  life: 5,
  damage: 5,
  cd: 0.09,
  range: 190,
  formation: 34,
  dropTime: 0.45,
};

/** Superpowers grow with the wave so they stay relevant past wave 20. */
export function powerScale(wave: number): number {
  return 1 + Math.max(0, wave - 1) * 0.16;
}


// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export type EnemyKind = "swarm" | "runner" | "brute" | "snail" | "boss";

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  reward: number;
  armor: number;
  radius: number;
  scale: number;
  lives: number;
  sprite: "swarm" | "runner" | "brute" | "snail" | "boss";
  color: string;
  split?: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  swarm: {
    kind: "swarm",
    name: "Zoomie Gremlin",
    hp: 18,
    speed: 82,
    reward: 6,
    armor: 0,
    radius: 12,
    scale: 0.52,
    lives: 1,
    sprite: "swarm",
    color: "#79ff9b",
  },
  runner: {
    kind: "runner",
    name: "Espresso Goblin",
    hp: 30,
    speed: 122,
    reward: 8,
    armor: 0,
    radius: 12,
    scale: 0.52,
    lives: 1,
    sprite: "runner",
    color: "#ffb066",
  },
  brute: {
    kind: "brute",
    name: "Dump Truck Chungus",
    hp: 105,
    speed: 52,
    reward: 16,
    armor: 0.1,
    radius: 17,
    scale: 0.38,
    lives: 2,
    sprite: "brute",
    color: "#ff7a7a",
    split: 2,
  },
  snail: {
    kind: "snail",
    name: "Shielded Snail",
    hp: 75,
    speed: 38,
    reward: 12,
    armor: 0.38,
    radius: 15,
    scale: 0.5,
    lives: 1,
    sprite: "snail",
    color: "#8fd3ff",
  },
  boss: {
    kind: "boss",
    name: "MEGA CHUNGUS",
    hp: 700,
    speed: 30,
    reward: 150,
    armor: 0.15,
    radius: 26,
    scale: 0.58,
    lives: 5,
    sprite: "boss",
    color: "#ff5d8f",
  },
};

export function hpScale(wave: number): number {
  return Math.pow(1.115, wave - 1);
}

export function speedScale(wave: number): number {
  return Math.min(1.3, 1 + (wave - 1) * 0.008);
}

export function rewardScale(wave: number): number {
  return Math.pow(1.035, wave - 1);
}

export function spawnInterval(wave: number): number {
  return Math.max(0.26, 0.62 - wave * 0.012);
}

export interface WaveInfo {
  queue: EnemyKind[];
  counts: Partial<Record<EnemyKind, number>>;
  total: number;
  boss: boolean;
  hpScale: number;
  interval: number;
}

export function waveInfo(wave: number): WaveInfo {
  const n = Math.min(46, 6 + Math.floor(wave * 1.9));
  const runners = wave >= 2 ? Math.floor(n * 0.25) : 0;
  const brutes = wave >= 4 ? Math.floor(n * 0.16) : 0;
  const snails = wave >= 6 ? Math.floor(n * 0.14) : 0;
  const swarm = Math.max(2, n - runners - brutes - snails);
  const boss = wave % 5 === 0 && wave >= 5;

  const groups: EnemyKind[][] = [];
  const push = (kind: EnemyKind, count: number) => {
    if (count > 0) groups.push(Array.from({ length: count }, () => kind));
  };
  push("swarm", swarm);
  push("runner", runners);
  push("brute", brutes);
  push("snail", snails);
  if (boss) push("boss", 1);

  // Round-robin so the conga line stays varied instead of one giant blob.
  const queue: EnemyKind[] = [];
  let alive = true;
  let i = 0;
  while (alive) {
    alive = false;
    for (const group of groups) {
      if (i < group.length) {
        queue.push(group[i]);
        alive = true;
      }
    }
    i++;
  }

  const counts: Partial<Record<EnemyKind, number>> = {};
  for (const k of queue) counts[k] = (counts[k] ?? 0) + 1;

  return {
    queue,
    counts,
    total: queue.length,
    boss,
    hpScale: hpScale(wave),
    interval: spawnInterval(wave),
  };
}

export function waveBonus(wave: number): number {
  return 25 + wave * 6;
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

export type TargetMode = "first" | "last" | "strong" | "weak" | "close";

export const TARGET_MODES: { id: TargetMode; label: string; hint: string }[] = [
  { id: "first", label: "Front of line", hint: "shoot whoever is closest to your crystal" },
  { id: "last", label: "Back of line", hint: "shoot the stragglers first" },
  { id: "strong", label: "Biggest threat", hint: "focus the highest health enemy" },
  { id: "weak", label: "Finish the smalls", hint: "focus the lowest health enemy" },
  { id: "close", label: "Closest", hint: "shoot whoever is nearest the turret" },
];

export function targetLabel(mode: TargetMode): string {
  return TARGET_MODES.find((m) => m.id === mode)?.label ?? mode;
}

export function enemyShort(kind: EnemyKind): string {
  switch (kind) {
    case "swarm":
      return "zoomie";
    case "runner":
      return "espresso";
    case "brute":
      return "chungus";
    case "snail":
      return "snail";
    case "boss":
      return "BOSS";
  }
}

// ---------------------------------------------------------------------------
// Meta progression
// ---------------------------------------------------------------------------

export type MetaId = "damage" | "cash" | "lives" | "bounty";

export interface MetaDef {
  id: MetaId;
  name: string;
  desc: string;
  max: number;
  cost: (level: number) => number;
}

export const META: MetaDef[] = [
  {
    id: "damage",
    name: "Bigger Booms",
    desc: "+4% tower damage per level",
    max: 8,
    cost: (l) => 20 + l * 18,
  },
  {
    id: "cash",
    name: "Trust Fund",
    desc: "+$20 starting cash per level",
    max: 5,
    cost: (l) => 25 + l * 25,
  },
  {
    id: "lives",
    name: "Extra Hugs",
    desc: "+2 base lives per level",
    max: 5,
    cost: (l) => 30 + l * 30,
  },
  {
    id: "bounty",
    name: "Gremlin Bounty",
    desc: "+5% cash from kills per level",
    max: 5,
    cost: (l) => 30 + l * 30,
  },
];

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "wave5", name: "Not Bad", desc: "Reach wave 5" },
  { id: "wave10", name: "Gremlin Wrangler", desc: "Reach wave 10" },
  { id: "wave20", name: "Local Menace", desc: "Reach wave 20" },
  { id: "wave30", name: "They Fear You", desc: "Reach wave 30" },
  { id: "kills100", name: "Pest Control", desc: "100 kills in one run" },
  { id: "kills500", name: "Exterminator", desc: "500 kills in one run" },
  { id: "flawless10", name: "Untouchable", desc: "Reach wave 10 without losing a life" },
  { id: "boss", name: "Chungus Down", desc: "Defeat a boss" },
  { id: "collector", name: "Full Arsenal", desc: "Build all 6 tower types in one run" },
  { id: "bigspender", name: "Investor", desc: "Spend $2000 in one run" },
  { id: "protein", name: "Protein Shake", desc: "Upgrade a tower to level 3" },
];

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToPath(p: Vec): number {
  let best = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) {
    best = Math.min(best, pointSegmentDistance(p, PATH[i], PATH[i + 1]));
  }
  return best;
}

export const PATH_LENGTH = (() => {
  let total = 0;
  for (let i = 0; i < PATH.length - 1; i++) total += dist(PATH[i], PATH[i + 1]);
  return total;
})();

/** Distance travelled along the path when standing on waypoint `index`. */
export function pathProgressAt(index: number): number {
  let total = 0;
  for (let i = 0; i < index && i < PATH.length - 1; i++) total += dist(PATH[i], PATH[i + 1]);
  return total;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function angleLerp(from: number, to: number, t: number): number {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * t;
}

export function formatMoney(n: number): string {
  return "$" + Math.floor(n).toLocaleString("en-US");
}
