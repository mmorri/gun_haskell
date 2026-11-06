// Balance harness: plays the game with a simple greedy builder and reports
// how far it gets. Not shipped; run with `node sim-run.mjs`.
import {
  BOARD,
  GRID,
  PATH,
  PATH_WIDTH,
  TOWER_BY_KIND,
  TOWERS,
  dist,
  distToPath,
  type TowerKind,
  type Vec,
} from "./src/config";
import { cellCenter, createGame, placeTower, startWave, towerStats, update, upgradeTower, upgradePrice } from "./src/game";
import { defaultSave } from "./src/save";
import type { Game } from "./src/types";

const samples: Vec[] = [];
for (let i = 0; i < PATH.length - 1; i++) {
  const a = PATH[i];
  const b = PATH[i + 1];
  const n = Math.ceil(dist(a, b) / 12);
  for (let k = 0; k < n; k++) samples.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
}

const cells: Vec[] = [];
for (let row = 0; row < 16; row++) {
  for (let col = 0; col < 23; col++) {
    const p = cellCenter(col, row);
    if (p.x > BOARD.x + 20 && p.x < BOARD.x + BOARD.w - 20 && p.y > BOARD.y + 20 && p.y < BOARD.y + BOARD.h - 20 && distToPath(p) > PATH_WIDTH / 2 + 13) {
      cells.push(p);
    }
  }
}

function coverage(p: Vec, range: number): number {
  let n = 0;
  for (const s of samples) if (dist(p, s) <= range) n++;
  return n;
}

function bestCell(g: Game, kind: TowerKind): Vec | null {
  const def = TOWER_BY_KIND[kind];
  let best: Vec | null = null;
  let bestScore = 0;
  for (const c of cells) {
    if (g.towers.some((t) => dist(t.pos, c) < 32)) continue;
    const score = coverage(c, def.range);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 6 ? best : null;
}

const ORDERS: TowerKind[][] = [
  ["pew", "pew", "brrrt", "nanny", "frost", "yeet", "pew", "brrrt", "tesla", "nanny", "yeet", "frost"],
  ["brrrt", "brrrt", "pew", "frost", "yeet", "nanny", "brrrt", "tesla", "pew"],
  ["nanny", "frost", "pew", "brrrt", "yeet", "nanny", "tesla", "pew"],
  ["yeet", "brrrt", "frost", "pew", "nanny", "tesla", "yeet", "brrrt"],
  ["tesla", "pew", "brrrt", "frost", "nanny", "yeet", "pew", "brrrt"],
];

function shop(g: Game, order: TowerKind[]): void {
  for (let guard = 0; guard < 80; guard++) {
    let kind = order[Math.min(g.towers.length, order.length - 1)];
    // A real player would not sit on their hands waiting for an expensive tower.
    if (g.cash < TOWER_BY_KIND[kind].cost && g.towers.length === 0) {
      const fallback = TOWERS.filter((t) => t.cost <= g.cash).sort((a, b) => b.damage / b.cd - a.damage / a.cd)[0];
      if (fallback) kind = fallback.kind;
    }
    const def = TOWER_BY_KIND[kind];
    if (g.cash >= def.cost) {
      const cell = bestCell(g, kind);
      if (cell && placeTower(g, kind, cell)) continue;
    }
    if (g.cash >= 220) {
      const cands = g.towers.filter((t) => t.level < 3).sort((a, b) => upgradePrice(a) - upgradePrice(b));
      if (cands[0] && upgradeTower(g, cands[0].id)) continue;
    }
    break;
  }
}

function run(order: TowerKind[]): void {
  const g = createGame(defaultSave());
  g.speed = 2;
  const log: string[] = [];
  for (let wave = 1; wave <= 60; wave++) {
    shop(g, order);
    startWave(g);
    let t = 0;
    let bossMin = Infinity;
    while (g.phase === "combat" && t < 240) {
      update(g, 1 / 60);
      t += 1 / 60;
      for (const e of g.enemies) if (e.boss) bossMin = Math.min(bossMin, e.hp);
    }
    const active = g.towers.filter((tw) => samples.some((s) => dist(tw.pos, s) <= towerStats(tw, g.damageMult).range)).length;
    log.push(
      `w${g.wave - (g.phase === "gameover" ? 0 : 1)} cash=${Math.round(g.cash)} lives=${g.lives} towers=${g.towers.length} active=${active} kills=${g.stats.kills}${bossMin < Infinity ? " bossMin=" + Math.round(bossMin) : ""}`,
    );
    if (g.phase === "gameover") break;
  }
  const dmg = g.towers.reduce((s, t) => s + towerStats(t, g.damageMult).damage, 0);
  console.log(`ORDER ${order.slice(0, 3).join(",")}... -> wave ${g.wave} lives ${g.lives} kills ${g.stats.kills} towers ${g.towers.length}`);
  console.log("  " + log.join("\n  "));
}

for (const order of ORDERS) run(order);
