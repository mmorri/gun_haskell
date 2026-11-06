import {
  BOARD,
  BASE_POS,
  ENEMIES,
  GRID,
  MAX_LEVEL,
  PATH,
  PATH_WIDTH,
  SELL_RATE,
  START_CASH,
  START_LIVES,
  TOWERS,
  TOWER_BY_KIND,
  clamp,
  dist,
  distToPath,
  hpScale,
  lerp,
  pathProgressAt,
  speedScale,
  rewardScale,
  upgradeCost,
  waveBonus,
  waveInfo,
  type EnemyKind,
  type TowerKind,
  type Vec,
} from "./config";
import { metaEffects } from "./save";
import type { Beam, Bullet, Enemy, Game, Particle, SaveData, Tower } from "./types";

const TAU = Math.PI * 2;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGame(save: SaveData): Game {
  const fx = metaEffects(save);
  const maxLives = START_LIVES + fx.startLives;
  return {
    phase: "shop",
    paused: false,
    wave: 1,
    cash: START_CASH + fx.startCash,
    lives: maxLives,
    maxLives,
    towers: [],
    enemies: [],
    bullets: [],
    particles: [],
    texts: [],
    beams: [],
    queue: [],
    queueTotal: 0,
    spawned: 0,
    spawnTimer: 0,
    spawnInterval: 0.6,
    time: 0,
    speed: 1,
    shake: 0,
    flash: 0,
    placing: null,
    selected: null,
    hover: null,
    mouse: { x: 0, y: 0 },
    nextId: 1,
    stats: { kills: 0, leaks: 0, spent: 0, built: new Set(), maxed: false, bossKilled: false, cashEarned: 0 },
    damageMult: fx.damageMult,
    cashMult: fx.cashMult,
    startCash: START_CASH + fx.startCash,
    startLives: maxLives,
    waveBanked: 0,
    banner: { text: "SHOP PHASE", sub: "place towers, then press SPACE", life: 2.2, maxLife: 2.2 },
    bossWave: false,
    rng: mulberry32(Date.now() >>> 0),
  };
}

// ---------------------------------------------------------------------------
// Tower maths
// ---------------------------------------------------------------------------

export function towerStats(t: Tower, damageMult: number) {
  const lv = t.level - 1;
  return {
    damage: t.def.damage * Math.pow(1.6, lv) * damageMult,
    range: t.def.range * Math.pow(1.08, lv),
    cd: t.def.cd * Math.pow(0.88, lv),
    splash: (t.def.splash ?? 0) * Math.pow(1.12, lv),
  };
}

export function totalInvested(t: Tower): number {
  return t.spent;
}

export function sellValue(t: Tower): number {
  return Math.round(t.spent * SELL_RATE);
}

export function upgradePrice(t: Tower): number {
  return upgradeCost(t);
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export function cellCenter(col: number, row: number): Vec {
  return { x: BOARD.x + GRID / 2 + col * GRID, y: BOARD.y + GRID / 2 + row * GRID };
}

export function cellAt(p: Vec): Vec | null {
  const col = Math.round((p.x - BOARD.x - GRID / 2) / GRID);
  const row = Math.round((p.y - BOARD.y - GRID / 2) / GRID);
  const c = cellCenter(col, row);
  if (c.x < BOARD.x + 20 || c.x > BOARD.x + BOARD.w - 20) return null;
  if (c.y < BOARD.y + 20 || c.y > BOARD.y + BOARD.h - 20) return null;
  return c;
}

export function placementError(g: Game, kind: TowerKind, pos: Vec): string | null {
  const def = TOWER_BY_KIND[kind];
  if (g.cash < def.cost) return "not enough cash";
  if (distToPath(pos) < PATH_WIDTH / 2 + 13) return "that's the gremlin road";
  for (const t of g.towers) if (dist(t.pos, pos) < 32) return "tower already here";
  return null;
}

export function canPlace(g: Game, kind: TowerKind, pos: Vec): boolean {
  return placementError(g, kind, pos) === null;
}

export function placeTower(g: Game, kind: TowerKind, pos: Vec): Tower | null {
  if (g.phase !== "shop" || placementError(g, kind, pos)) return null;
  const def = TOWER_BY_KIND[kind];
  const tower: Tower = {
    id: g.nextId++,
    kind,
    def,
    pos,
    level: 1,
    cd: 0.15,
    spent: def.cost,
    target: "first",
    angle: -Math.PI / 2,
    recoil: 0,
    kills: 0,
  };
  g.cash -= def.cost;
  g.stats.spent += def.cost;
  g.stats.built.add(kind);
  g.towers.push(tower);
  burst(g, pos.x, pos.y, def.color, 12, 90, 0.5);
  addBeam(g, [{ ...pos }, { ...pos }], def.color, 0.18, 3, false);
  emit(g, "place");
  return tower;
}

export function upgradeTower(g: Game, id: number): boolean {
  if (g.phase !== "shop") return false;
  const t = g.towers.find((x) => x.id === id);
  if (!t || t.level >= MAX_LEVEL) return false;
  const price = upgradeCost(t);
  if (g.cash < price) return false;
  g.cash -= price;
  t.spent += price;
  t.level++;
  g.stats.spent += price;
  if (t.level >= MAX_LEVEL) g.stats.maxed = true;
  burst(g, t.pos.x, t.pos.y, "#ffe27a", 18, 120, 0.7);
  addText(g, t.pos.x, t.pos.y - 24, "LEVEL " + t.level, "#ffe27a", 1.0, 17);
  emit(g, "upgrade");
  return true;
}

export function sellTower(g: Game, id: number): boolean {
  if (g.phase !== "shop") return false;
  const idx = g.towers.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  const t = g.towers[idx];
  const refund = Math.round(t.spent * SELL_RATE);
  g.cash += refund;
  g.towers.splice(idx, 1);
  if (g.selected === id) g.selected = null;
  burst(g, t.pos.x, t.pos.y, "#ffd166", 10, 70, 0.5);
  addText(g, t.pos.x, t.pos.y - 20, "+$" + refund, "#ffd166", 0.9, 16);
  emit(g, "coin");
  return true;
}

export function cycleTarget(g: Game, id: number): void {
  const t = g.towers.find((x) => x.id === id);
  if (!t) return;
  const order = ["first", "last", "strong", "weak", "close"] as const;
  const i = order.indexOf(t.target);
  t.target = order[(i + 1) % order.length];
  emit(g, "select");
}

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------

export function startWave(g: Game): void {
  if (g.phase !== "shop") return;
  const info = waveInfo(g.wave);
  g.phase = "combat";
  g.queue = info.queue.slice();
  g.queueTotal = info.total;
  g.spawned = 0;
  g.spawnTimer = 0;
  g.spawnInterval = info.interval;
  g.bossWave = info.boss;
  g.placing = null;
  g.selected = null;
  g.banner = {
    text: "WAVE " + g.wave,
    sub: info.boss ? "⚠ MEGA CHUNGUS INCOMING ⚠" : "here they come…",
    life: 1.8,
    maxLife: 1.8,
  };
  emit(g, "wave");
}

export function wavePreview(g: Game) {
  return waveInfo(g.wave);
}

function spawnEnemy(g: Game, kind: EnemyKind, at?: Vec, wp?: number): Enemy {
  const def = ENEMIES[kind];
  const isBoss = kind === "boss";
  const hpMul = isBoss ? Math.pow(1.1, g.wave - 1) : hpScale(g.wave);
  const spdMul = isBoss ? 1 + (g.wave - 1) * 0.006 : speedScale(g.wave);
  const maxHp = Math.round(def.hp * hpMul);
  const e: Enemy = {
    id: g.nextId++,
    kind,
    def,
    pos: at ? { ...at } : { ...PATH[0] },
    hp: maxHp,
    maxHp,
    baseSpeed: def.speed * spdMul,
    speed: def.speed * spdMul,
    armor: def.armor,
    reward: Math.round(def.reward * rewardScale(g.wave) * g.cashMult),
    radius: def.radius,
    wp: wp ?? 1,
    travelled: wp ? pathProgressAt(Math.max(0, wp - 1)) : 0,
    slowT: 0,
    slowFactor: 1,
    flash: 0,
    alive: true,
    boss: isBoss,
  };
  g.enemies.push(e);
  return e;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

function emit(g: Game, name: string): void {
  g.onEvent?.(name);
}

export function burst(
  g: Game,
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 110,
  life = 0.6,
  size = 3,
): void {
  if (g.particles.length > 700) return;
  for (let i = 0; i < count; i++) {
    const a = g.rng() * TAU;
    const s = speed * (0.25 + g.rng() * 0.9);
    const l = life * (0.5 + g.rng() * 0.9);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: l,
      maxLife: l,
      size: size * (0.5 + g.rng()),
      color,
      gravity: 40,
      drag: 2.6,
      shape: g.rng() < 0.35 ? "spark" : "circle",
    });
  }
}

function ring(g: Game, x: number, y: number, color: string, size: number, life = 0.35): void {
  g.particles.push({
    x,
    y,
    vx: 0,
    vy: 0,
    life,
    maxLife: life,
    size,
    color,
    gravity: 0,
    drag: 0,
    shape: "ring",
  });
}

export function addText(
  g: Game,
  x: number,
  y: number,
  text: string,
  color: string,
  life = 0.7,
  size = 14,
): void {
  if (g.texts.length > 120) return;
  g.texts.push({ x, y, text, color, life, maxLife: life, size });
}

export function addBeam(g: Game, pts: Vec[], color: string, life: number, width: number, chain: boolean): void {
  g.beams.push({ pts, color, life, maxLife: life, width, chain });
}

// ---------------------------------------------------------------------------
// Damage & death
// ---------------------------------------------------------------------------

function damageEnemy(g: Game, e: Enemy, amount: number, source?: Tower): void {
  if (!e.alive) return;
  const dealt = amount * (1 - e.armor);
  e.hp -= dealt;
  e.flash = 0.14;
  if (dealt >= 12) addText(g, e.pos.x + (g.rng() - 0.5) * 10, e.pos.y - e.radius - 4, String(Math.round(dealt)), "#ffffff", 0.45, 13);
  if (e.hp <= 0) {
    killEnemy(g, e, source);
  } else {
    burst(g, e.pos.x, e.pos.y, "#ffd6a0", 2, 50, 0.25, 2);
  }
}

function killEnemy(g: Game, e: Enemy, source?: Tower): void {
  if (!e.alive) return;
  e.alive = false;
  g.stats.kills++;
  if (source) source.kills++;
  g.cash += e.reward;
  g.stats.cashEarned += e.reward;
  addText(g, e.pos.x, e.pos.y - 8, "+$" + e.reward, "#ffd166", 0.8, e.boss ? 22 : 14);
  burst(g, e.pos.x, e.pos.y, e.def.color, e.boss ? 46 : 12, e.boss ? 260 : 120, 0.7, e.boss ? 5 : 3);
  ring(g, e.pos.x, e.pos.y, e.def.color, e.boss ? 30 : 12, 0.3);
  emit(g, "coin");

  if (e.def.split) {
    for (let i = 0; i < e.def.split; i++) {
      const child = spawnEnemy(g, "swarm", {
        x: e.pos.x + (i === 0 ? -9 : 9),
        y: e.pos.y + (i === 0 ? 9 : -9),
      }, e.wp);
      child.hp = Math.max(8, Math.round(e.maxHp * 0.2));
      child.maxHp = child.hp;
      child.baseSpeed = e.baseSpeed * 1.35;
      child.reward = 4;
    }
    burst(g, e.pos.x, e.pos.y, "#ffb3b3", 10, 150, 0.5, 3);
  }

  if (e.boss) {
    g.stats.bossKilled = true;
    g.shake = Math.max(g.shake, 18);
    g.flash = 0.35;
    g.banner = { text: "CHUNGUS DOWN", sub: "absolute unit evacuated", life: 1.6, maxLife: 1.6 };
    for (let i = 0; i < 4; i++) ring(g, e.pos.x, e.pos.y, "#ff5d8f", 20 + i * 12, 0.5 + i * 0.12);
    emit(g, "boom");
  }
}

function leak(g: Game, e: Enemy): void {
  e.alive = false;
  g.lives -= e.def.lives;
  g.stats.leaks += e.def.lives;
  g.shake = Math.max(g.shake, 10);
  g.flash = Math.max(g.flash, 0.18);
  addText(g, BASE_POS.x, BASE_POS.y - 30, "-" + e.def.lives + " hugs", "#ff5d8f", 1.1, e.boss ? 24 : 16);
  burst(g, BASE_POS.x, BASE_POS.y, "#ff5d8f", 16, 150, 0.7, 3);
  emit(g, "leak");
  if (g.lives <= 0) {
    g.lives = 0;
    g.phase = "gameover";
    g.selected = null;
    g.placing = null;
    g.banner = null;
    emit(g, "over");
  }
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

function selectTarget(g: Game, t: Tower, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestScore = Infinity;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const d = dist(t.pos, e.pos);
    if (d > range + e.radius) continue;
    let score: number;
    switch (t.target) {
      case "first":
        score = -e.travelled;
        break;
      case "last":
        score = e.travelled;
        break;
      case "strong":
        score = -e.hp;
        break;
      case "weak":
        score = e.hp;
        break;
      default:
        score = d;
    }
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

function predict(e: Enemy, from: Vec, speed: number): Vec {
  const next = PATH[Math.min(e.wp, PATH.length - 1)];
  const d = dist(e.pos, next) || 1;
  const flight = dist(from, e.pos) / Math.max(1, speed);
  const nx = e.pos.x + ((next.x - e.pos.x) / d) * e.baseSpeed * flight * 0.85;
  const ny = e.pos.y + ((next.y - e.pos.y) / d) * e.baseSpeed * flight * 0.85;
  return { x: nx, y: ny };
}

function fire(g: Game, t: Tower, target: Enemy): void {
  shotsFired++;
  const stats = towerStats(t, g.damageMult);
  t.cd = stats.cd;
  t.recoil = 1;
  emit(g, t.kind === "brrrt" ? "brrrt" : "pew");

  const angle = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
  t.angle = angle;
  const muzzle = { x: t.pos.x + Math.cos(angle) * 15, y: t.pos.y + Math.sin(angle) * 15 };

  if (t.kind === "nanny") {
    addBeam(g, [{ ...muzzle }, { ...target.pos }], "#ffd7e2", 0.16, 4, false);
    burst(g, target.pos.x, target.pos.y, "#ffd7e2", 4, 70, 0.3, 2);
    damageEnemy(g, target, stats.damage, t);
    return;
  }

  if (t.kind === "tesla") {
    const hit: Enemy[] = [target];
    let current = target;
    const links = Math.max(1, (t.def.chain ?? 1));
    for (let i = 0; i < links; i++) {
      let next: Enemy | null = null;
      let nd = 105;
      for (const e of g.enemies) {
        if (!e.alive || hit.includes(e)) continue;
        const d = dist(current.pos, e.pos);
        if (d < nd) {
          nd = d;
          next = e;
        }
      }
      if (!next) break;
      hit.push(next);
      current = next;
    }
    const pts: Vec[] = [{ ...muzzle }];
    hit.forEach((e, i) => {
      pts.push({ ...e.pos });
      damageEnemy(g, e, stats.damage * Math.pow(0.8, i), t);
    });
    addBeam(g, pts, "#d9c2ff", 0.2, 3, true);
    g.shake = Math.max(g.shake, 2);
    return;
  }

  const aim = predict(target, muzzle, t.def.projSpeed);
  const dx = aim.x - muzzle.x;
  const dy = aim.y - muzzle.y;
  const d = Math.hypot(dx, dy) || 1;
  const bullet: Bullet = {
    id: g.nextId++,
    ownerId: t.id,
    kind: t.kind === "yeet" ? "shell" : t.kind === "frost" ? "frost" : "bullet",
    def: t.def,
    pos: { ...muzzle },
    prev: { ...muzzle },
    vel: { x: (dx / d) * t.def.projSpeed, y: (dy / d) * t.def.projSpeed },
    speed: t.def.projSpeed,
    damage: stats.damage,
    life: 2.5,
    splash: stats.splash,
    slowFactor: t.def.slowFactor ?? 1,
    slowDur: t.def.slowDur ?? 0,
    alive: true,
  };
  bulletsMade++;
  g.bullets.push(bullet);
  ring(g, muzzle.x, muzzle.y, t.def.color, 7, 0.16);
  addBeam(g, [{ ...muzzle }, { x: muzzle.x + Math.cos(angle) * 30, y: muzzle.y + Math.sin(angle) * 30 }], t.def.color, 0.08, 3.5, false);
  if (g.rng() < 0.04) addText(g, muzzle.x, muzzle.y - 12, "PEW!", t.def.color, 0.5, 11);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export let shotsFired = 0;
export let bulletsHit = 0;
export let bulletsMade = 0;

export function debugTowerRanges(g: Game) {
  return g.towers.map((t) => {
    const st = towerStats(t, g.damageMult);
    let n = 0;
    let minD = Infinity;
    for (const e of g.enemies) {
      const d = dist(t.pos, e.pos);
      if (d < minD) minD = d;
      if (d <= st.range + e.radius) n++;
    }
    return { kind: t.kind, x: t.pos.x, y: t.pos.y, n, minD: Math.round(minD), range: Math.round(st.range), angle: +t.angle.toFixed(2), cd: +t.cd.toFixed(2) };
  });
}

export function update(g: Game, rawDt: number): void {
  const dt = Math.min(0.05, rawDt);
  g.shake = Math.max(0, g.shake - dt * 30);
  g.flash = Math.max(0, g.flash - dt * 1.6);
  updateEffects(g, dt);

  if (g.phase === "gameover" || g.phase === "shop") {
    if (g.phase === "shop") g.time += dt;
    return;
  }
  if (g.paused) return;

  const scaled = dt * g.speed;
  g.time += scaled;

  // Spawn.
  if (g.queue.length > 0) {
    g.spawnTimer -= scaled;
    if (g.spawnTimer <= 0) {
      const kind = g.queue.shift()!;
      spawnEnemy(g, kind);
      g.spawned++;
      g.spawnTimer = g.spawnInterval;
    }
  }

  // Enemies.
  for (const e of g.enemies) {
    if (!e.alive) continue;
    if (e.slowT > 0) {
      e.slowT -= scaled;
      e.speed = e.baseSpeed * e.slowFactor;
    } else {
      e.speed = e.baseSpeed;
    }
    let remaining = e.speed * scaled;
    while (remaining > 0 && e.wp < PATH.length) {
      const target = PATH[e.wp];
      const d = dist(e.pos, target);
      if (d <= remaining) {
        e.pos.x = target.x;
        e.pos.y = target.y;
        e.travelled += d;
        remaining -= d;
        e.wp++;
      } else {
        e.pos.x += ((target.x - e.pos.x) / d) * remaining;
        e.pos.y += ((target.y - e.pos.y) / d) * remaining;
        e.travelled += remaining;
        remaining = 0;
      }
    }
    if (e.wp >= PATH.length) leak(g, e);
  }
  if ((g.phase as string) === "gameover") {
    g.enemies = g.enemies.filter((e) => e.alive);
    return;
  }

  // Towers.
  for (const t of g.towers) {
    t.cd -= scaled;
    t.recoil = Math.max(0, t.recoil - dt * 5);
    const stats = towerStats(t, g.damageMult);
    const target = selectTarget(g, t, stats.range);
    if (target) {
      const want = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
      t.angle = lerpAngle(t.angle, want, Math.min(1, dt * 14));
      if (t.cd <= 0) fire(g, t, target);
    }
    if (t.cd < 0) t.cd = 0;
  }

  // Bullets.
  for (const b of g.bullets) {
    if (!b.alive) continue;
    b.prev.x = b.pos.x;
    b.prev.y = b.pos.y;
    b.pos.x += b.vel.x * scaled;
    b.pos.y += b.vel.y * scaled;
    b.life -= scaled;
    if (b.life <= 0 || b.pos.x < -80 || b.pos.x > 1360 || b.pos.y < -80 || b.pos.y > 800) {
      b.alive = false;
      continue;
    }
    let hit: Enemy | null = null;
    let bestT = Infinity;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = pointSeg(b.prev, b.pos, e.pos);
      if (d <= e.radius + 3) {
        const t = dist(b.prev, e.pos);
        if (t < bestT) {
          bestT = t;
          hit = e;
        }
      }
    }
    if (!hit) continue;
    bulletsHit++;
    b.alive = false;
    if (b.kind === "shell") {
      boom(g, b.pos, b.damage, b.splash);
    } else {
      damageEnemy(g, hit, b.damage, g.towers.find((tw) => tw.id === b.ownerId));
      if (b.kind === "frost" && b.slowDur > 0) {
        hit.slowT = Math.max(hit.slowT, b.slowDur);
        hit.slowFactor = Math.min(hit.slowFactor, b.slowFactor);
        burst(g, hit.pos.x, hit.pos.y, "#bfefff", 5, 60, 0.4, 2);
      }
    }
  }
  g.bullets = g.bullets.filter((b) => b.alive);
  g.enemies = g.enemies.filter((e) => e.alive);

  // Wave finished?
  if (g.phase === "combat" && g.queue.length === 0 && g.enemies.length === 0) {
    const cleared = g.wave;
    const bonus = waveBonus(cleared) + g.spawned * 0;
    g.cash += bonus;
    g.stats.cashEarned += bonus;
    g.wave = cleared + 1;
    g.phase = "shop";
    g.waveBanked = bonus;
    g.banner = {
      text: "WAVE CLEARED",
      sub: "+$" + bonus + " wave bonus · spend it wisely",
      life: 2.4,
      maxLife: 2.4,
    };
    emit(g, "upgrade");
  }

  for (const e of g.enemies) if (e.flash > 0) e.flash -= dt;
}

function boom(g: Game, at: Vec, damage: number, radius: number): void {
  ring(g, at.x, at.y, "#ffb066", radius, 0.4);
  burst(g, at.x, at.y, "#ffb066", 22, 210, 0.7, 4);
  burst(g, at.x, at.y, "#ff5d3a", 10, 140, 0.5, 3);
  g.shake = Math.max(g.shake, 5);
  emit(g, "boom");
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const d = dist(at, e.pos);
    if (d > radius + e.radius) continue;
    const falloff = 1 - clamp((d - e.radius) / radius, 0, 1) * 0.55;
    damageEnemy(g, e, damage * falloff);
  }
}

function updateEffects(g: Game, dt: number): void {
  for (const p of g.particles) {
    p.life -= dt;
    if (p.shape === "ring") continue;
    p.vy += p.gravity * dt;
    const drag = Math.max(0, 1 - p.drag * dt);
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  g.particles = g.particles.filter((p) => p.life > 0);

  for (const t of g.texts) {
    t.life -= dt;
    t.y -= 24 * dt;
  }
  g.texts = g.texts.filter((t) => t.life > 0);

  for (const b of g.beams) b.life -= dt;
  g.beams = g.beams.filter((b) => b.life > 0);

  if (g.banner) {
    g.banner.life -= dt;
    if (g.banner.life <= 0) g.banner = null;
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function pointSeg(a: Vec, b: Vec, p: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(a, p);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function runSummary(g: Game, save: SaveData) {
  const teeth = Math.floor(g.wave * 2.4 + g.stats.kills * 0.12 + (g.stats.bossKilled ? 8 : 0));
  const achievements: string[] = [];
  if (g.wave >= 5) achievements.push("wave5");
  if (g.wave >= 10) achievements.push("wave10");
  if (g.wave >= 20) achievements.push("wave20");
  if (g.wave >= 30) achievements.push("wave30");
  if (g.stats.kills >= 100) achievements.push("kills100");
  if (g.stats.kills >= 500) achievements.push("kills500");
  if (g.wave >= 10 && g.stats.leaks === 0) achievements.push("flawless10");
  if (g.stats.bossKilled) achievements.push("boss");
  if (g.stats.built.size >= TOWERS.length) achievements.push("collector");
  if (g.stats.spent >= 2000) achievements.push("bigspender");
  if (g.stats.maxed) achievements.push("protein");

  return { teeth, achievements, newBest: g.wave > save.bestWave };
}
