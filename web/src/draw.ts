import {
  ACHIEVEMENTS,
  BASE_POS,
  BOARD,
  ENEMIES,
  GRID,
  H,
  HUD_H,
  META,
  MAX_LEVEL,
  PATH,
  PATH_WIDTH,
  PORTAL_POS,
  SIDEBAR,
  TARGET_MODES,
  TOWERS,
  TOWER_BY_KIND,
  W,
  clamp,
  dist,
  formatMoney,
  targetLabel,
  enemyShort,
  type EnemyKind,
  type TowerKind,
  type Vec,
} from "./config";
import type { Sprites } from "./assets";
import { placementError, sellValue, towerStats, upgradePrice, wavePreview } from "./game";
import { metaCost, metaLevel, metaMaxed } from "./save";
import type { Game, SaveData } from "./types";
import {
  BACK_BTN,
  CARD_H,
  CARD_W,
  CARD_X,
  HUD_BUTTONS,
  PAUSE_BUTTONS,
  SETTINGS_BUTTONS,
  START_BTN,
  TITLE_BUTTONS,
  GAMEOVER_BUTTONS,
  metaButtons,
  towerCards,
  type Hit,
  type Screen,
} from "./ui";

// ---------------------------------------------------------------------------
// Palette + tiny helpers
// ---------------------------------------------------------------------------

const C = {
  ink: "#e9f1ff",
  dim: "#8ea2c4",
  faint: "#5c6d8c",
  cyan: "#6fe3ff",
  blue: "#4f9dff",
  green: "#7dffa8",
  gold: "#ffd166",
  orange: "#ff9d4d",
  pink: "#ff5d8f",
  violet: "#c9a7ff",
  red: "#ff6b6b",
  panel: "#0c1322",
  panel2: "#111a2d",
  line: "#22314f",
};

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
const font = (size: number, weight = 600) => `${weight} ${size}px ${FONT}`;

function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 10): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = C.panel,
  stroke = C.line,
  r = 14,
): void {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke !== "none") {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 600,
  align: CanvasTextAlign = "left",
): void {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

function shadowText(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 800,
  align: CanvasTextAlign = "center",
): void {
  ctx.save();
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText(s, x + 2, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(-7, -3, -4, -8, 0, -4);
  ctx.bezierCurveTo(4, -8, 7, -3, 0, 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function tooth(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-6, -5);
  ctx.bezierCurveTo(-6, -9, 6, -9, 6, -5);
  ctx.bezierCurveTo(7, 0, 4, 7, 2.5, 7);
  ctx.bezierCurveTo(1, 7, 1, 2, 0, 2);
  ctx.bezierCurveTo(-1, 2, -1, 7, -2.5, 7);
  ctx.bezierCurveTo(-4, 7, -7, 0, -6, -5);
  ctx.closePath();
  ctx.fillStyle = "#f4f7ff";
  ctx.fill();
  ctx.strokeStyle = "#9aa9c7";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffcf5c";
  ctx.fill();
  ctx.strokeStyle = "#b9851f";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, "$", x, y + 0.5, r * 1.35, "#7a4d00", 800, "center");
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Button rendering
// ---------------------------------------------------------------------------

type Theme = "green" | "blue" | "dark" | "pink" | "gold";

const THEMES: Record<Theme, { a: string; b: string; edge: string; text: string }> = {
  green: { a: "#1c7a4a", b: "#114a2e", edge: "#63f0a4", text: "#eafff2" },
  blue: { a: "#1c4f8a", b: "#122f52", edge: "#6fc3ff", text: "#eaf6ff" },
  dark: { a: "#16203a", b: "#0d1424", edge: "#33456b", text: "#dbe6ff" },
  pink: { a: "#8a1c47", b: "#4e102a", edge: "#ff8fb3", text: "#ffeaf1" },
  gold: { a: "#8a671c", b: "#4e3a10", edge: "#ffd166", text: "#fff6dc" },
};

function drawButton(
  ctx: CanvasRenderingContext2D,
  r: Hit,
  label: string,
  sub: string | null,
  theme: Theme,
  hover: boolean,
  disabled = false,
): void {
  const t = THEMES[theme];
  ctx.save();
  ctx.globalAlpha = disabled ? 0.42 : 1;
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, hover && !disabled ? lighten(t.a) : t.a);
  g.addColorStop(1, t.b);
  rr(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = hover && !disabled ? "#ffffff" : t.edge;
  ctx.lineWidth = hover && !disabled ? 2 : 1.2;
  ctx.stroke();
  if (hover && !disabled) {
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.clip();
    const shine = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    shine.addColorStop(0, "rgba(255,255,255,0.14)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.02)");
    ctx.fillStyle = shine;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  const cy = sub ? r.y + r.h / 2 - 9 : r.y + r.h / 2;
  text(ctx, label, r.x + r.w / 2, cy, sub ? 18 : 19, t.text, 800, "center");
  if (sub) text(ctx, sub, r.x + r.w / 2, r.y + r.h / 2 + 13, 11, alpha(t.text, 0.72), 600, "center");
  ctx.restore();
}

function lighten(hex: string): string {
  const h = hex.replace("#", "");
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + 26);
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + 26);
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + 26);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

function img(
  ctx: CanvasRenderingContext2D,
  im: HTMLImageElement | null,
  x: number,
  y: number,
  scale: number,
  rot = 0,
  a = 1,
): boolean {
  if (!im) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = a;
  ctx.drawImage(im, -64 * scale, -64 * scale, 128 * scale, 128 * scale);
  ctx.restore();
  return true;
}

function drawTowerIcon(ctx: CanvasRenderingContext2D, sp: Sprites, kind: TowerKind, x: number, y: number, size: number, angle = 0): void {
  const s = size / 128;
  switch (kind) {
    case "pew":
      if (!img(ctx, sp.pewBase, x, y, s)) circleBase(ctx, x, y, size * 0.42, C.cyan);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 40, size / 40);
      drawBarrel(ctx, 24, angle, C.cyan, 2.1);
      ctx.restore();
      break;
    case "nanny":
      if (!img(ctx, sp.nannyBase, x, y, s)) circleBase(ctx, x, y, size * 0.42, C.pink);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 40, size / 40);
      drawBarrel(ctx, 28, angle, C.pink, 1.3);
      ctx.restore();
      break;
    case "brrrt":
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 40, size / 40);
      drawMinigun(ctx, 0, angle, 1, C.gold);
      ctx.restore();
      break;
    case "yeet":
      if (!img(ctx, sp.yeet, x, y, s, angle)) circleBase(ctx, x, y, size * 0.42, C.orange);
      break;
    case "frost":
      drawFrost(ctx, x, y, size * 0.46, angle);
      break;
    case "tesla":
      drawTesla(ctx, x, y, size * 0.46, angle);
      break;
  }
}

function circleBase(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#1a2338";
  ctx.fill();
  ctx.strokeStyle = alpha(color, 0.65);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = alpha(color, 0.8);
  ctx.fill();
}

function drawFrost(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.1);
  g.addColorStop(0, "#d9f6ff");
  g.addColorStop(1, "#2d6d92");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#9be7ff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.rotate(angle + Math.PI / 2);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
    ctx.stroke();
    for (const side of [-1, 1]) {
      const bx = Math.cos(a) * r * 0.72;
      const by = Math.sin(a) * r * 0.72;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + side * 1.1) * r * 0.35, by + Math.sin(a + side * 1.1) * r * 0.35);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTesla(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = "#231a38";
  ctx.fill();
  ctx.strokeStyle = "#c9a7ff";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, -i * r * 0.22, r * 0.72 - i * r * 0.14, r * 0.22, 0, 0, Math.PI * 2);
    ctx.strokeStyle = alpha("#c9a7ff", 0.7 - i * 0.15);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -r * 0.7, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = "#f0e4ff";
  ctx.fill();
  ctx.strokeStyle = "#c9a7ff";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const a = angle + i * 2.1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7);
    ctx.lineTo(Math.cos(a) * r * 0.5, -r * 0.7 + Math.sin(a) * r * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

const STARS = Array.from({ length: 170 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1) * W, y: r(2) * H, s: 0.5 + r(3) * 1.7, tw: r(4) * Math.PI * 2, sp: 0.4 + r(5) * 1.4 };
});

function drawSky(ctx: CanvasRenderingContext2D, time: number, reduced: boolean): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#070b18");
  g.addColorStop(0.55, "#0a1022");
  g.addColorStop(1, "#05070f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const neb = ctx.createRadialGradient(W * 0.28, H * 0.2, 20, W * 0.28, H * 0.2, 520);
  neb.addColorStop(0, "rgba(64,110,255,0.16)");
  neb.addColorStop(1, "rgba(64,110,255,0)");
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, W, H);

  const neb2 = ctx.createRadialGradient(W * 0.8, H * 0.75, 10, W * 0.8, H * 0.75, 460);
  neb2.addColorStop(0, "rgba(255,64,150,0.09)");
  neb2.addColorStop(1, "rgba(255,64,150,0)");
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, W, H);

  for (const st of STARS) {
    const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(time * st.sp + st.tw);
    ctx.globalAlpha = 0.25 + tw * 0.55;
    ctx.fillStyle = st.s > 1.6 ? "#bfe5ff" : "#ffffff";
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

function strokeRoad(ctx: CanvasRenderingContext2D, width: number, color: string, dash?: number[]): void {
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke();
  if (dash) ctx.setLineDash([]);
}

function drawBoard(ctx: CanvasRenderingContext2D, g: Game, sp: Sprites, time: number, reduced: boolean): void {
  ctx.save();
  rr(ctx, BOARD.x, BOARD.y, BOARD.w, BOARD.h, 16);
  ctx.clip();

  const bg = ctx.createLinearGradient(0, BOARD.y, 0, BOARD.y + BOARD.h);
  bg.addColorStop(0, "#0b1224");
  bg.addColorStop(1, "#080d18");
  ctx.fillStyle = bg;
  ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);

  const glow = ctx.createRadialGradient(BOARD.x + BOARD.w * 0.3, BOARD.y + BOARD.h * 0.3, 10, BOARD.x + BOARD.w * 0.3, BOARD.y + BOARD.h * 0.3, 420);
  glow.addColorStop(0, "rgba(60,110,220,0.12)");
  glow.addColorStop(1, "rgba(60,110,220,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);

  // Faint grid, mostly useful while building.
  const gridAlpha = g.phase === "shop" ? 0.075 : 0.035;
  ctx.strokeStyle = `rgba(120,190,255,${gridAlpha})`;
  ctx.lineWidth = 1;
  for (let x = BOARD.x + GRID; x < BOARD.x + BOARD.w; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x, BOARD.y);
    ctx.lineTo(x, BOARD.y + BOARD.h);
    ctx.stroke();
  }
  for (let y = BOARD.y + GRID; y < BOARD.y + BOARD.h; y += GRID) {
    ctx.beginPath();
    ctx.moveTo(BOARD.x, y);
    ctx.lineTo(BOARD.x + BOARD.w, y);
    ctx.stroke();
  }

  // Road.
  strokeRoad(ctx, PATH_WIDTH + 22, "rgba(0,0,0,0.45)");
  strokeRoad(ctx, PATH_WIDTH + 12, "#2b2318");
  strokeRoad(ctx, PATH_WIDTH + 4, "#6b5636");
  strokeRoad(ctx, PATH_WIDTH, "#c3a267");
  strokeRoad(ctx, PATH_WIDTH - 12, "#dcc18c");
  ctx.globalAlpha = 0.22;
  strokeRoad(ctx, 3, "#fff6dc", [14, 22]);
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  drawPortalAndBase(ctx, sp, time, reduced);

  // Range previews.
  const selected = g.towers.find((t) => t.id === g.selected);
  if (selected) drawRange(ctx, selected.pos, towerStats(selected, g.damageMult).range, C.cyan, 0.1);

  // Towers.
  for (const t of g.towers) drawTower(ctx, sp, g, t, time, t.id === g.selected);

  // Enemies.
  for (const e of g.enemies) drawEnemy(ctx, sp, g, e, time, reduced);

  // Beams.
  for (const b of g.beams) drawBeam(ctx, b.pts, b.color, b.life / b.maxLife, b.width, b.chain);

  // Bullets.
  for (const b of g.bullets) drawBullet(ctx, sp, b, time);

  // Particles.
  for (const p of g.particles) {
    const k = p.life / p.maxLife;
    if (p.shape === "ring") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (1 - k) * 2.4), 0, Math.PI * 2);
      ctx.strokeStyle = alpha(p.color, k * 0.7);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (p.shape === "spark") {
      ctx.strokeStyle = alpha(p.color, k);
      ctx.lineWidth = Math.max(1, p.size * 0.7);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else {
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.7), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Floating text.
  for (const t of g.texts) {
    const k = t.life / t.maxLife;
    ctx.globalAlpha = Math.min(1, k * 2);
    shadowText(ctx, t.text, t.x, t.y, t.size, t.color, 800, "center");
    ctx.globalAlpha = 1;
  }

  // Placement ghost.
  if (g.placing && g.hover) {
    const def = TOWER_BY_KIND[g.placing];
    const err = placementError(g, g.placing, g.hover);
    const ok = !err;
    drawRange(ctx, g.hover, def.range, ok ? C.green : C.red, 0.12);
    ctx.globalAlpha = 0.55;
    drawTowerIcon(ctx, sp, g.placing, g.hover.x, g.hover.y, 42, 0);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(g.hover.x, g.hover.y, 19, 0, Math.PI * 2);
    ctx.strokeStyle = ok ? C.green : C.red;
    ctx.lineWidth = 2;
    ctx.stroke();
    const label = ok ? "click to build" : err!;
    const width = ctx.measureText(label).width;
    panel(ctx, g.hover.x - width / 2 - 10, g.hover.y - 58, width + 20, 26, ok ? "rgba(10,40,24,0.95)" : "rgba(48,12,18,0.95)", ok ? C.green : C.red, 8);
    text(ctx, label, g.hover.x, g.hover.y - 45, 12, ok ? C.green : C.red, 700, "center");
  }

  // Vignette.
  const vig = ctx.createRadialGradient(BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h / 2, BOARD.h * 0.35, BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h / 2, BOARD.w * 0.72);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vig;
  ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);

  // Banner: parked at the top of the board so it never hides the action.
  if (g.banner) {
    const k = g.banner.life / g.banner.maxLife;
    const pop = 1 + Math.max(0, 0.1 - k * 0.1);
    const alphaK = Math.min(1, k * 4);
    ctx.save();
    ctx.translate(BOARD.x + BOARD.w / 2, BOARD.y + 66);
    ctx.scale(pop, pop);
    ctx.globalAlpha = alphaK;
    panel(ctx, -210, -34, 420, 68, "rgba(8,14,26,0.82)", alpha(C.cyan, 0.35), 12);
    shadowText(ctx, g.banner.text, 0, -4, 26, C.cyan, 900, "center");
    text(ctx, g.banner.sub, 0, 22, 11.5, C.ink, 600, "center");
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Frame.
  rr(ctx, BOARD.x, BOARD.y, BOARD.w, BOARD.h, 16);
  ctx.strokeStyle = "rgba(111,227,255,0.2)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawRange(ctx: CanvasRenderingContext2D, p: Vec, range: number, color: string, fill: number): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, range, 0, Math.PI * 2);
  ctx.fillStyle = alpha(color, fill);
  ctx.fill();
  ctx.strokeStyle = alpha(color, 0.45);
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawPortalAndBase(ctx: CanvasRenderingContext2D, _sp: Sprites, time: number, reduced: boolean): void {
  const px = PORTAL_POS.x;
  const py = PORTAL_POS.y;
  const slow = reduced ? 0 : time;

  const glow = ctx.createRadialGradient(px, py, 2, px, py, 58);
  glow.addColorStop(0, "rgba(80,255,220,0.35)");
  glow.addColorStop(0.6, "rgba(40,180,150,0.12)");
  glow.addColorStop(1, "rgba(80,255,220,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(px, py, 58, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(px, py);
  const core = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
  core.addColorStop(0, "rgba(180,255,240,0.9)");
  core.addColorStop(0.35, "rgba(30,140,120,0.85)");
  core.addColorStop(1, "rgba(6,30,34,0.95)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 15 + i * 5, slow * (1.2 + i * 0.5) + i * 2, slow * (1.2 + i * 0.5) + i * 2 + 2.1);
    ctx.strokeStyle = `rgba(140,255,225,${0.7 - i * 0.18})`;
    ctx.lineWidth = 2.5 - i * 0.5;
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const a = slow * 0.9 + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 29, Math.sin(a) * 29, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(160,255,235,0.75)";
    ctx.fill();
  }
  ctx.restore();

  text(ctx, "Gremlin Hole™", px, py + 44, 9.5, alpha(C.green, 0.8), 700, "center");

  const bx = BASE_POS.x;
  const by = BASE_POS.y;
  const pulse = 1 + Math.sin(slow * 2.6) * 0.05;
  const bob = Math.sin(slow * 1.8) * 2;

  const bglow = ctx.createRadialGradient(bx, by, 4, bx, by, 62);
  bglow.addColorStop(0, "rgba(120,200,255,0.38)");
  bglow.addColorStop(0.55, "rgba(255,93,143,0.16)");
  bglow.addColorStop(1, "rgba(255,93,143,0)");
  ctx.fillStyle = bglow;
  ctx.beginPath();
  ctx.arc(bx, by, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(bx, by + bob);
  ctx.scale(pulse, pulse);

  const gem = ctx.createLinearGradient(0, -26, 0, 26);
  gem.addColorStop(0, "#e6faff");
  gem.addColorStop(0.45, "#8fd3ff");
  gem.addColorStop(1, "#3f74c8");
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(16, -7);
  ctx.lineTo(11, 15);
  ctx.lineTo(0, 26);
  ctx.lineTo(-11, 15);
  ctx.lineTo(-16, -7);
  ctx.closePath();
  ctx.fillStyle = gem;
  ctx.fill();
  ctx.strokeStyle = "rgba(220,245,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(-5, 0);
  ctx.lineTo(0, 26);
  ctx.moveTo(-5, 0);
  ctx.lineTo(-16, -7);
  ctx.moveTo(-5, 0);
  ctx.lineTo(-11, 15);
  ctx.moveTo(0, -26);
  ctx.lineTo(6, 0);
  ctx.lineTo(11, 15);
  ctx.moveTo(6, 0);
  ctx.lineTo(16, -7);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 34 + Math.sin(slow * 2.6) * 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,140,180,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  heart(ctx, bx + 26, by - 30, 1.6, C.pink);
  text(ctx, "PROTECT", bx, by + 46, 9.5, alpha(C.pink, 0.85), 800, "center");
}

function drawTower(ctx: CanvasRenderingContext2D, sp: Sprites, g: Game, t: Game["towers"][number], time: number, selected: boolean): void {
  const stats = towerStats(t, g.damageMult);
  const recoil = t.recoil * 3.5;
  const dx = Math.cos(t.angle) * recoil;
  const dy = Math.sin(t.angle) * recoil;

  if (selected) {
    drawRange(ctx, t.pos, stats.range, C.cyan, 0.13);
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, 23, 0, Math.PI * 2);
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(t.pos.x + 2, t.pos.y + 14, 20, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fill();

  ctx.save();
  ctx.translate(t.pos.x + dx, t.pos.y + dy);
  switch (t.kind) {
    case "pew":
      if (!img(ctx, sp.pewBase, 0, 0, 0.62)) circleBase(ctx, 0, 0, 17, C.cyan);
      drawBarrel(ctx, 26, t.angle, C.cyan, 2.1);
      break;
    case "nanny":
      if (!img(ctx, sp.nannyBase, 0, 0, 0.62)) circleBase(ctx, 0, 0, 17, C.pink);
      drawBarrel(ctx, 31, t.angle, C.pink, 1.3);
      break;
    case "brrrt":
      drawMinigun(ctx, time, t.angle, t.level, C.gold);
      break;
    case "yeet":
      if (!img(ctx, sp.yeet, 0, 0, 0.62, t.angle)) circleBase(ctx, 0, 0, 17, C.orange);
      break;
    case "frost":
      drawFrost(ctx, 0, 0, 15, t.angle);
      break;
    case "tesla":
      drawTesla(ctx, 0, 0, 15, t.angle);
      break;
  }

  if (t.recoil > 0.7) {
    const mx = Math.cos(t.angle) * 20;
    const my = Math.sin(t.angle) * 20;
    ctx.beginPath();
    ctx.arc(mx, my, 4 + t.recoil * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = alpha(t.def.color, 0.9);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx, my, 2 + t.recoil * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.restore();

  for (let i = 0; i < t.level; i++) {
    starPath(ctx, t.pos.x - 8 + i * 8, t.pos.y + 20, 3.2);
    ctx.fillStyle = i < t.level ? C.gold : "#333a4d";
    ctx.fill();
  }
  if (selected) {
    text(ctx, t.def.short.toUpperCase(), t.pos.x, t.pos.y - 28, 9, C.cyan, 800, "center");
  }
}

function drawBarrel(ctx: CanvasRenderingContext2D, len: number, angle: number, color: string, weight = 1): void {
  ctx.save();
  ctx.rotate(angle);
  const half = 4 * weight;
  ctx.beginPath();
  ctx.roundRect(-4, -half, len + 4, half * 2, half);
  const g = ctx.createLinearGradient(0, -half, 0, half);
  g.addColorStop(0, "#cfd8ea");
  g.addColorStop(0.5, "#98a5bf");
  g.addColorStop(1, "#586480");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#0b1220";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Muzzle brake in the tower's accent colour.
  ctx.beginPath();
  ctx.roundRect(len - 8 * weight, -half - 1, 8 * weight, half * 2 + 2, 2.5);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#0b1220";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawMinigun(ctx: CanvasRenderingContext2D, time: number, angle: number, level: number, color: string): void {
  ctx.save();
  ctx.rotate(angle);

  // Barrels first so the housing overlaps them.
  const spin = time * 16;
  const barrels = 3 + level;
  ctx.lineCap = "round";
  for (let i = 0; i < barrels; i++) {
    const a = spin + (i * Math.PI * 2) / barrels;
    const oy = Math.sin(a) * 7.5;
    const front = Math.cos(a) > 0;
    ctx.beginPath();
    ctx.moveTo(4, oy);
    ctx.lineTo(28, oy);
    ctx.strokeStyle = front ? "#e6ecf8" : "#7d89a3";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, oy);
    ctx.lineTo(28, oy);
    ctx.strokeStyle = "#141b2b";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Muzzle ring.
  ctx.beginPath();
  ctx.ellipse(29, 0, 3.2, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#141b2b";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Housing.
  ctx.beginPath();
  ctx.roundRect(-12, -12, 20, 24, 6);
  const g = ctx.createLinearGradient(0, -12, 0, 12);
  g.addColorStop(0, "#cfd8ea");
  g.addColorStop(0.55, "#8e9ab5");
  g.addColorStop(1, "#4a5570");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#141b2b";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-9, -7, 8, 14, 3);
  ctx.fillStyle = alpha(color, 0.9);
  ctx.fill();
  ctx.restore();
}

function laneOffset(e: Game["enemies"][number]): { x: number; y: number } {
  const a = PATH[Math.max(0, e.wp - 1)] ?? e.pos;
  const b = PATH[Math.min(e.wp, PATH.length - 1)] ?? e.pos;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const lane = (((e.id * 2654435761) >>> 0) % 1000) / 1000;
  const off = (lane - 0.5) * 16;
  return { x: (-dy / len) * off, y: (dx / len) * off };
}

function drawEnemy(ctx: CanvasRenderingContext2D, sp: Sprites, g: Game, e: Game["enemies"][number], time: number, reduced: boolean): void {
  const bob = reduced ? 0 : Math.sin(time * 7 + e.id * 1.7) * 1.6;
  const next = PATH[Math.min(e.wp, PATH.length - 1)] ?? e.pos;
  const dir = Math.atan2(next.y - e.pos.y, next.x - e.pos.x);
  const lane = laneOffset(e);
  const px = e.pos.x + lane.x;
  const py = e.pos.y + lane.y;

  ctx.beginPath();
  ctx.ellipse(px + 2, py + e.radius * 0.72, e.radius * 0.95, e.radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fill();

  if (e.boss) {
    ctx.beginPath();
    ctx.arc(px, py, e.radius + 10 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = alpha(C.pink, 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(px, py + bob);
  if (e.kind === "snail") {
    drawSnail(ctx, e.radius);
  } else {
    drawGremlin(ctx, e.kind, e.def.color, e.radius, e.id, dir, time, reduced);
  }
  ctx.restore();

  // Hit flash.
  if (e.flash > 0) {
    ctx.beginPath();
    ctx.arc(px, py, e.radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${clamp(e.flash * 2.2, 0, 0.55)})`;
    ctx.fill();
  }

  // Boss label, kept clear of the health bar.
  if (e.boss) {
    const cx = px;
    const above = py - e.radius - 30;
    const labelY = above < BOARD.y + 16 ? py + e.radius + 30 : above;
    text(ctx, "MEGA CHUNGUS", cx, labelY, 10, C.gold, 900, "center");
  }

  // Health bar.
  const w = e.boss ? 64 : Math.max(22, e.radius * 2 + 8);
  const hp = clamp(e.hp / e.maxHp, 0, 1);
  const bx = px - w / 2;
  const by = py - e.radius - 12;
  rr(ctx, bx, by, w, 5, 2.5);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fill();
  const col = hp > 0.6 ? C.green : hp > 0.3 ? C.gold : C.red;
  if (hp > 0) {
    rr(ctx, bx, by, Math.max(2, w * hp), 5, 2.5);
    ctx.fillStyle = col;
    ctx.fill();
  }
  if (e.armor > 0.2) {
    ctx.beginPath();
    ctx.arc(bx - 7, by + 2.5, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = alpha(C.cyan, 0.9);
    ctx.fill();
    text(ctx, "A", bx - 7, by + 3, 7, "#06121e", 900, "center");
  }
  if (e.slowT > 0) {
    for (let i = 0; i < 3; i++) {
      const a = time * 2 + (i * Math.PI * 2) / 3;
      const x = px + Math.cos(a) * (e.radius + 5);
      const y = py + Math.sin(a) * (e.radius + 5);
      text(ctx, "❄", x, y, 9, alpha("#bfefff", 0.9), 700, "center");
    }
  }
}

// ---------------------------------------------------------------------------
// Gremlin anatomy (all original vector art)
// ---------------------------------------------------------------------------

function drawGremlin(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  color: string,
  radius: number,
  id: number,
  dir: number,
  time: number,
  reduced: boolean,
): void {
  const r = radius;
  const wobble = reduced ? 0 : Math.sin(time * 9 + id) * 0.04;

  // Speed lines for the runner.
  if (kind === "runner") {
    ctx.save();
    ctx.rotate(dir);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * (1.5 + i * 0.35), -r * 0.5 + i * r * 0.35);
      ctx.lineTo(-r * (2.5 + i * 0.4), -r * 0.5 + i * r * 0.35);
      ctx.strokeStyle = alpha("#ffb066", 0.28 - i * 0.06);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Body.
  const bodyColor = kind === "boss" ? "#c23456" : color;
  const dark = kind === "boss" ? "#6d1830" : shade(bodyColor, -0.45);
  const light = kind === "boss" ? "#ff7d9d" : shade(bodyColor, 0.35);

  ctx.save();
  ctx.scale(1 + wobble, 1 - wobble);

  if (kind === "brute" || kind === "boss") {
    // Chunky armoured slab.
    rr(ctx, -r, -r * 0.92, r * 2, r * 1.8, r * 0.45);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, light);
    g.addColorStop(0.6, bodyColor);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#1a0d14";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Bolted plates.
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * r * 0.68, -r * 0.5, 2.4, 0, Math.PI * 2);
      ctx.arc(sx * r * 0.68, r * 0.55, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = alpha("#ffffff", 0.35);
      ctx.fill();
    }
    // Horns.
    ctx.beginPath();
    ctx.moveTo(-r * 0.86, -r * 0.8);
    ctx.lineTo(-r * 1.18, -r * 1.5);
    ctx.lineTo(-r * 0.5, -r * 0.95);
    ctx.moveTo(r * 0.86, -r * 0.8);
    ctx.lineTo(r * 1.18, -r * 1.5);
    ctx.lineTo(r * 0.5, -r * 0.95);
    ctx.fillStyle = "#f2e4cf";
    ctx.fill();
    ctx.strokeStyle = "#7a6448";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    // Bouncy blob with a little tail.
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.9);
    ctx.quadraticCurveTo(-r * 1.25, r * 1.25, -r * 0.95, r * 0.25);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.5, -r * 0.15, r * 0.75);
    ctx.closePath();
    ctx.fillStyle = dark;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, light);
    g.addColorStop(0.65, bodyColor);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#0c1a12";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Antennae.
    ctx.lineCap = "round";
    for (const sx of [-1, 1]) {
      const sway = reduced ? 0 : Math.sin(time * 5 + sx + id) * r * 0.1;
      ctx.beginPath();
      ctx.moveTo(sx * r * 0.45, -r * 0.85);
      ctx.quadraticCurveTo(sx * r * 0.72 + sway, -r * 1.35, sx * r * 0.95 + sway, -r * 1.45);
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1.2, r * 0.11);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx * r * 0.95 + sway, -r * 1.45, Math.max(1.6, r * 0.14), 0, Math.PI * 2);
      ctx.fillStyle = kind === "runner" ? "#fff3b0" : "#d9ffb0";
      ctx.fill();
    }
  }

  // Eyes (googly, looking along the path).
  const ex = clamp(Math.cos(dir) * r * 0.12, -r * 0.14, r * 0.14);
  const ey = clamp(Math.sin(dir) * r * 0.12, -r * 0.14, r * 0.14);
  const eyeR = kind === "boss" ? r * 0.3 : r * 0.32;
  for (const sx of [-1, 1]) {
    const px = sx * r * 0.38;
    const py = -r * 0.14;
    ctx.beginPath();
    ctx.arc(px, py, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = "#f7fcff";
    ctx.fill();
    ctx.strokeStyle = "rgba(10,16,26,0.65)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + ex, py + ey, eyeR * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = "#10161f";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + ex - eyeR * 0.16, py + ey - eyeR * 0.18, eyeR * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  // Angry brows for the heavy units.
  if (kind === "brute" || kind === "boss") {
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, -r * 0.52);
    ctx.lineTo(-r * 0.18, -r * 0.3);
    ctx.moveTo(r * 0.72, -r * 0.52);
    ctx.lineTo(r * 0.18, -r * 0.3);
    ctx.strokeStyle = "#24101a";
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Mouth: a grin with a couple of deeply questionable teeth.
  const mouthY = r * 0.42;
  ctx.beginPath();
  if (kind === "runner") {
    // Oof, running.
    ctx.ellipse(0, mouthY, r * 0.2, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#33131b";
    ctx.fill();
  } else {
    ctx.arc(0, mouthY - r * 0.08, r * 0.36, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = "#33131b";
    ctx.lineWidth = Math.max(1.4, r * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, mouthY + r * 0.04);
    ctx.lineTo(-r * 0.08, mouthY + r * 0.22);
    ctx.lineTo(0, mouthY + r * 0.04);
    ctx.lineTo(r * 0.08, mouthY + r * 0.22);
    ctx.lineTo(r * 0.16, mouthY + r * 0.04);
    ctx.fillStyle = "#fdf6e0";
    ctx.fill();
  }

  ctx.restore();
}

function drawSnail(ctx: CanvasRenderingContext2D, r: number): void {
  // Shell.
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.fillStyle = "#2d4a63";
  ctx.fill();
  ctx.strokeStyle = "#b9e6ff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 26; i++) {
    const a = i * 0.7;
    const rr2 = (i / 26) * r * 0.78;
    const x = Math.cos(a) * rr2;
    const y = Math.sin(a) * rr2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#9fdcff";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Determined little eyestalks.
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * r * 0.3, -r * 0.75);
    ctx.lineTo(sx * r * 0.42, -r * 1.2);
    ctx.strokeStyle = "#7fb4cf";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx * r * 0.42, -r * 1.22, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = "#dff6ff";
    ctx.fill();
  }
}

function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const r = clamp(((n >> 16) & 255) + 255 * amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + 255 * amt, 0, 255);
  const b = clamp((n & 255) + 255 * amt, 0, 255);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function drawBullet(ctx: CanvasRenderingContext2D, sp: Sprites, b: Game["bullets"][number], time: number): void {
  const len = Math.hypot(b.vel.x, b.vel.y) || 1;
  const tx = b.pos.x - (b.vel.x / len) * 16;
  const ty = b.pos.y - (b.vel.y / len) * 16;
  if (b.kind === "shell") {
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcf8a";
    ctx.fill();
    ctx.strokeStyle = "#ff7a2f";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.pos.x, b.pos.y);
    ctx.strokeStyle = "rgba(255,150,70,0.4)";
    ctx.lineWidth = 6;
    ctx.stroke();
  } else if (b.kind === "frost") {
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#dff8ff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, 8 + Math.sin(time * 20) * 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(160,235,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    const col = b.def.color;
    ctx.beginPath();
    ctx.moveTo(tx - (b.vel.x / len) * 10, ty - (b.vel.y / len) * 10);
    ctx.lineTo(b.pos.x, b.pos.y);
    ctx.strokeStyle = alpha(col, 0.22);
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.pos.x, b.pos.y);
    ctx.strokeStyle = alpha(col, 0.85);
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.pos.x, b.pos.y);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
}

function drawBeam(ctx: CanvasRenderingContext2D, pts: Vec[], color: string, k: number, width: number, chain: boolean): void {
  if (pts.length < 2) return;
  const lines: Vec[][] = [];
  if (chain) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const seg: Vec[] = [a];
      for (let j = 1; j < 4; j++) {
        const t = j / 4;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const off = (Math.random() - 0.5) * 14;
        seg.push({ x: a.x + dx * t - (dy / len) * off, y: a.y + dy * t + (dx / len) * off });
      }
      seg.push(b);
      lines.push(seg);
    }
  } else {
    lines.push(pts);
  }

  for (const seg of lines) {
    ctx.beginPath();
    ctx.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    ctx.strokeStyle = alpha(color, k * 0.3);
    ctx.lineWidth = width + 6;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    ctx.strokeStyle = alpha(color, k);
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    ctx.strokeStyle = alpha("#ffffff", k * 0.8);
    ctx.lineWidth = Math.max(1, width * 0.35);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// HUD + sidebar
// ---------------------------------------------------------------------------

function drawHud(ctx: CanvasRenderingContext2D, g: Game, hover: string | null, muted: boolean): void {
  const hg = ctx.createLinearGradient(0, 0, 0, HUD_H);
  hg.addColorStop(0, "#0c1526");
  hg.addColorStop(1, "#080d18");
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.strokeStyle = "rgba(111,227,255,0.16)";
  ctx.lineWidth = 1;
  line(ctx, 0, HUD_H - 0.5, W, HUD_H - 0.5, "rgba(111,227,255,0.16)");

  text(ctx, "PEW-PEW", 18, 27, 19, C.cyan, 900);
  text(ctx, "DEFENSE DELUXE", 18, 45, 9, alpha(C.cyan, 0.55), 700);

  // Wave chip.
  panel(ctx, 146, 15, 92, 34, "rgba(30,44,74,0.9)", alpha(C.cyan, 0.35), 9);
  text(ctx, "WAVE", 162, 26, 8, C.dim, 800);
  text(ctx, String(g.wave), 162, 39, 15, C.ink, 900);

  // Cash.
  coin(ctx, 262, 32, 9);
  text(ctx, formatMoney(g.cash), 277, 32, 18, C.gold, 800);
  text(ctx, "cash", 277, 47, 8, alpha(C.gold, 0.55), 700);

  // Lives.
  heart(ctx, 388, 32, 1.5, C.pink);
  text(ctx, String(g.lives), 402, 31, 18, C.ink, 800);
  text(ctx, "hugs", 402, 47, 8, alpha(C.pink, 0.6), 700);

  // Kills.
  text(ctx, "☠", 486, 32, 16, C.dim, 700);
  text(ctx, String(g.stats.kills), 504, 31, 16, C.ink, 800);
  text(ctx, "kills", 504, 47, 8, alpha(C.dim, 0.7), 700);

  // Progress or phase.
  if (g.phase === "combat") {
    const total = Math.max(1, g.queueTotal);
    const done = g.spawned;
    const p = clamp(done / total, 0, 1);
    panel(ctx, 590, 18, 200, 28, "rgba(16,24,42,0.9)", alpha(C.line, 0.9), 8);
    rr(ctx, 594, 22, 192 * p, 20, 6);
    ctx.fillStyle = alpha(C.cyan, 0.35);
    ctx.fill();
    text(ctx, `${Math.max(0, g.enemies.length)} left · ${done}/${total} spawned`, 690, 32, 10, C.ink, 700, "center");
  } else if (g.phase === "shop") {
    text(ctx, "SHOP PHASE", 600, 32, 13, C.green, 800);
  }

  // HUD buttons.
  for (const b of HUD_BUTTONS) {
    const isHover = hover === b.id;
    const label = b.id === "speed" ? (g.speed > 1 ? "2x ▶▶" : "1x ▶") : b.id === "pause" ? "II" : b.id === "mute" ? (muted ? "♪̸" : "♪") : "☰";
    const active = b.id === "speed" && g.speed > 1;
    const bg = isHover ? "#1c2a47" : active ? "#173a52" : "#111a2d";
    panel(ctx, b.x, b.y, b.w, b.h, bg, isHover ? C.cyan : C.line, 9);
    text(ctx, label, b.x + b.w / 2, b.y + b.h / 2, b.id === "pause" ? 13 : 12, isHover ? C.ink : C.dim, 800, "center");
  }
}

function drawSidebar(ctx: CanvasRenderingContext2D, g: Game, sp: Sprites, save: SaveData, hover: string | null): void {
  const gd = ctx.createLinearGradient(SIDEBAR.x, 0, SIDEBAR.x + SIDEBAR.w, 0);
  gd.addColorStop(0, "#0b1221");
  gd.addColorStop(1, "#080d19");
  ctx.fillStyle = gd;
  ctx.fillRect(SIDEBAR.x, SIDEBAR.y, SIDEBAR.w, SIDEBAR.h);
  line(ctx, SIDEBAR.x + 0.5, SIDEBAR.y, SIDEBAR.x + 0.5, H, "rgba(111,227,255,0.14)");

  const tower = g.towers.find((t) => t.id === g.selected);
  if (tower) {
    drawInspector(ctx, g, tower, sp, hover);
    return;
  }

  if (g.phase === "shop") {
    text(ctx, "TOWER SHOP", SIDEBAR.x + 18, 92, 17, C.ink, 900);
    text(ctx, "no refunds. okay, some refunds.", SIDEBAR.x + 18, 110, 10, C.dim, 500);
  } else {
    text(ctx, "WAVE " + g.wave, SIDEBAR.x + 18, 92, 17, C.ink, 900);
    text(ctx, "the conga line is here", SIDEBAR.x + 18, 110, 10, C.dim, 500);
  }

  if (g.phase === "shop") {
    TOWERS.forEach((t, i) => {
      const c = towerCards()[i];
      const affordable = g.cash >= t.cost;
      const placing = g.placing === t.kind;
      const isHover = hover === c.id;
      const bg = placing ? "rgba(30,86,120,0.95)" : isHover ? "#16233c" : affordable ? "rgba(20,38,32,0.9)" : "rgba(38,18,24,0.75)";
      panel(ctx, c.x, c.y, c.w, c.h, bg, placing ? C.cyan : isHover ? alpha(C.cyan, 0.5) : C.line, 9);
      ctx.save();
      ctx.globalAlpha = affordable ? 1 : 0.45;
      drawTowerIcon(ctx, sp, t.kind, c.x + 27, c.y + 23, 36, 0);
      text(ctx, t.short, c.x + 48, c.y + 16, 13, C.ink, 800);
      text(ctx, t.blurb, c.x + 48, c.y + 32, 9.5, C.dim, 500);
      text(ctx, "$" + t.cost, c.x + c.w - 32, c.y + 18, 13, affordable ? C.gold : C.red, 800, "right");
      text(ctx, "[" + t.hotkey + "]", c.x + c.w - 12, c.y + 18, 9, C.faint, 700, "right");
      text(ctx, "DPS " + Math.round(t.damage / t.cd), c.x + c.w - 12, c.y + 34, 9, C.dim, 600, "right");
      ctx.restore();
    });

    // Next wave panel.
    const info = wavePreview(g);
    panel(ctx, CARD_X, 444, CARD_W, 80, "rgba(14,22,38,0.9)", C.line, 10);
    text(ctx, "NEXT: WAVE " + g.wave, CARD_X + 12, 458, 11, C.dim, 800);
    if (info.boss) text(ctx, "BOSS WAVE", CARD_X + CARD_W - 12, 458, 10, C.pink, 900, "right");
    else text(ctx, info.total + " gremlins", CARD_X + CARD_W - 12, 458, 10, C.dim, 700, "right");
    drawWaveCounts(ctx, info.counts, CARD_X + 12, 486, CARD_W - 24);

    drawButton(ctx, START_BTN, "START WAVE  ▶", "or press SPACE, coward", "green", hover === "start", false);

    text(ctx, "1–6 pick · click map to build", CARD_X, 614, 9.5, C.faint, 600);
    text(ctx, "right-click cancels placement", CARD_X, 630, 9.5, C.faint, 600);
    text(ctx, "SPACE start · F speed · ESC pause", CARD_X, 646, 9.5, C.faint, 600);
  } else {
    drawCombatSidebar(ctx, g, hover);
  }
}

function drawWaveCounts(ctx: CanvasRenderingContext2D, counts: Partial<Record<EnemyKind, number>>, x: number, y: number, width: number): void {
  const entries = (Object.keys(counts) as EnemyKind[]).filter((k) => (counts[k] ?? 0) > 0);
  let cx = x;
  for (const k of entries) {
    const def = ENEMIES[k];
    ctx.beginPath();
    ctx.arc(cx + 4, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = def.color;
    ctx.fill();
    const label = (counts[k] ?? 0) + " " + enemyShort(k);
    text(ctx, label, cx + 12, y, 10, C.ink, 600);
    ctx.font = font(10, 600);
    cx += ctx.measureText(label).width + 26;
    if (cx > x + width - 50) {
      cx = x;
      y += 20;
    }
  }
}

function drawCombatSidebar(ctx: CanvasRenderingContext2D, g: Game, hover: string | null): void {
  const total = Math.max(1, g.queueTotal);
  const done = g.spawned;
  const p = clamp(done / total, 0, 1);

  panel(ctx, CARD_X, 132, CARD_W, 96, "rgba(14,22,38,0.9)", C.line, 10);
  text(ctx, "WAVE PROGRESS", CARD_X + 12, 148, 10, C.dim, 800);
  rr(ctx, CARD_X + 12, 160, CARD_W - 24, 16, 8);
  ctx.fillStyle = "#0a0f1c";
  ctx.fill();
  rr(ctx, CARD_X + 12, 160, Math.max(6, (CARD_W - 24) * p), 16, 8);
  ctx.fillStyle = alpha(C.cyan, 0.65);
  ctx.fill();
  text(ctx, `${g.enemies.length} alive · ${g.queue.length} queued`, CARD_X + 12, 194, 10, C.ink, 700);
  text(ctx, `${g.spawned}/${g.queueTotal} spawned`, CARD_X + CARD_W - 12, 194, 10, C.dim, 600, "right");
  text(ctx, `+${g.stats.cashEarned} cash earned · ${g.stats.kills} kills`, CARD_X + 12, 212, 9.5, C.faint, 600);

  const counts: Partial<Record<EnemyKind, number>> = {};
  for (const e of g.enemies) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  for (const k of g.queue) counts[k] = (counts[k] ?? 0) + 1;
  panel(ctx, CARD_X, 242, CARD_W, 92, "rgba(14,22,38,0.9)", C.line, 10);
  text(ctx, "STILL OUT THERE", CARD_X + 12, 258, 10, C.dim, 800);
  drawWaveCounts(ctx, counts, CARD_X + 12, 286, CARD_W - 24);

  panel(ctx, CARD_X, 348, CARD_W, 196, "rgba(14,22,38,0.75)", C.line, 10);
  text(ctx, "FIELD MANUAL", CARD_X + 12, 366, 10, C.dim, 800);
  const tips = [
    "Click a tower to inspect it.",
    "Its targeting mode can be changed mid-wave.",
    "F toggles double speed. No judgement.",
    "Crystal hugs are a limited resource.",
    "Brutes split. Finish the job twice.",
    "The nanny sees everything.",
  ];
  tips.forEach((tip, i) => text(ctx, "· " + tip, CARD_X + 12, 390 + i * 23, 10.5, i % 2 ? C.dim : C.ink, 500));
}

function drawInspector(ctx: CanvasRenderingContext2D, g: Game, t: Game["towers"][number], sp: Sprites, hover: string | null): void {
  const stats = towerStats(t, g.damageMult);
  const x = SIDEBAR.x + 16;
  const w = SIDEBAR.w - 32;

  drawTowerIcon(ctx, sp, t.kind, x + 28, 110, 52, 0);
  text(ctx, t.def.name, x + 54, 100, 14, C.ink, 900);
  for (let i = 0; i < MAX_LEVEL; i++) {
    starPath(ctx, x + 58 + i * 13, 118, 5);
    ctx.fillStyle = i < t.level ? C.gold : "#2a3348";
    ctx.fill();
  }
  text(ctx, "LVL " + t.level + (t.level >= MAX_LEVEL ? " · MAX" : ""), x + 100, 118, 9, C.dim, 700);

  panel(ctx, x, 140, w, 168, "rgba(14,22,38,0.9)", C.line, 10);
  const rows: [string, string][] = [
    ["DAMAGE", String(Math.round(stats.damage))],
    ["RANGE", String(Math.round(stats.range))],
    ["FIRE RATE", (1 / stats.cd).toFixed(2) + "/s"],
    ["DPS", String(Math.round(stats.damage / stats.cd))],
    ["KILLS", String(t.kills)],
    ["INVESTED", "$" + t.spent],
  ];
  rows.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    text(ctx, k, x + 12 + col * (w / 2), 162 + row * 34, 9, C.dim, 700);
    text(ctx, v, x + 12 + col * (w / 2), 178 + row * 34, 14, C.ink, 800);
  });

  // Target mode.
  const targetHit: Hit = { id: "target", x, y: 334, w, h: 50 };
  panel(ctx, x, 334, w, 50, hover === "target" ? "#182742" : "rgba(22,32,54,0.95)", hover === "target" ? C.cyan : C.line, 9);
  text(ctx, "TARGETING", x + 12, 349, 8.5, C.dim, 800);
  text(ctx, targetLabel(t.target), x + 12, 366, 13, C.cyan, 800);
  text(ctx, "click to cycle ▸", x + w - 12, 366, 9, C.faint, 600, "right");

  const price = upgradePrice(t);
  const maxed = t.level >= MAX_LEVEL;
  const canUp = !maxed && g.phase === "shop" && g.cash >= price;
  const upHit: Hit = { id: "upgrade", x, y: 394, w, h: 52 };
  drawButton(ctx, upHit, maxed ? "MAX LEVEL" : "UPGRADE  ·  $" + price, maxed ? "this turret has peaked" : "+60% damage · +8% range", maxed ? "dark" : canUp ? "blue" : "dark", hover === "upgrade", !canUp);

  const sv = sellValue(t);
  const canSell = g.phase === "shop";
  const sellHit: Hit = { id: "sell", x, y: 456, w, h: 46 };
  drawButton(ctx, sellHit, "SELL  ·  +$" + sv, null, "pink", hover === "sell", !canSell);

  text(ctx, g.phase === "shop" ? "Upgrades are cheaper than regret." : "You can't build mid-wave. Character growth.", x, 526, 9.5, C.faint, 500);
  text(ctx, "Click the X to go back to the shop.", x, 544, 9.5, C.faint, 500);

  // Close.
  panel(ctx, SIDEBAR.x + SIDEBAR.w - 52, 92, 40, 40, hover === "close" ? "#2a1830" : "#141c30", hover === "close" ? C.pink : C.line, 9);
  text(ctx, "✕", SIDEBAR.x + SIDEBAR.w - 32, 112, 16, C.ink, 700, "center");
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export interface View {
  screen: Screen;
  save: SaveData;
  hover: string | null;
  time: number;
  resetArmed: boolean;
  gameover: { teeth: number; best: boolean; unlocked: string[] } | null;
  toast: { text: string; life: number; maxLife: number } | null;
}

export function render(ctx: CanvasRenderingContext2D, g: Game, sp: Sprites, view: View): void {
  ctx.clearRect(0, 0, W, H);
  if (view.screen === "title") {
    drawTitle(ctx, sp, view);
  } else if (view.screen === "meta") {
    drawMeta(ctx, view);
  } else if (view.screen === "help") {
    drawHelp(ctx);
  } else if (view.screen === "settings") {
    drawSettings(ctx, view);
  } else {
    drawSky(ctx, view.time, view.save.settings.reducedMotion);
    drawBoard(ctx, g, sp, g.time, view.save.settings.reducedMotion);
    drawHud(ctx, g, view.hover, view.save.settings.muted);
    drawSidebar(ctx, g, sp, view.save, view.hover);
    if (view.screen === "gameover") drawGameOver(ctx, g, view);
    if (g.paused && view.screen === "playing") drawPause(ctx, view);
  }
  if (view.toast && view.screen !== "gameover") drawToast(ctx, view.toast);
}

function drawTitle(ctx: CanvasRenderingContext2D, sp: Sprites, view: View): void {
  drawSky(ctx, view.time, view.save.settings.reducedMotion);
  const cx = W / 2;

  // Decorative path swoosh.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(-40, 600);
  ctx.bezierCurveTo(300, 540, 880, 720, 1320, 560);
  ctx.strokeStyle = "#2b2318";
  ctx.lineWidth = 60;
  ctx.stroke();
  ctx.strokeStyle = "#6b5636";
  ctx.lineWidth = 48;
  ctx.stroke();
  ctx.strokeStyle = "#c3a267";
  ctx.lineWidth = 38;
  ctx.stroke();
  ctx.restore();

  const bob = (n: number) => Math.sin(view.time * 1.6 + n) * 7;
  const t = view.time;

  // The home team: two turrets, gently judging the camera.
  ctx.save();
  ctx.translate(136, 462 + bob(0) * 0.4);
  if (!img(ctx, sp.pewBase, 0, 0, 0.7)) circleBase(ctx, 0, 0, 18, C.cyan);
  drawBarrel(ctx, 30, 0.55 + Math.sin(t * 0.9) * 0.08, C.cyan, 2.2);
  ctx.restore();

  ctx.save();
  ctx.translate(1112, 292 + bob(1.4));
  if (!img(ctx, sp.nannyBase, 0, 0, 0.66)) circleBase(ctx, 0, 0, 18, C.pink);
  drawBarrel(ctx, 34, Math.PI + 0.35 + Math.sin(t * 0.7 + 1) * 0.1, C.pink, 1.4);
  ctx.restore();

  // The away team: two gremlins who absolutely started it.
  ctx.save();
  ctx.translate(300, 596 + bob(2.1));
  ctx.scale(1.45, 1.45);
  drawGremlin(ctx, "brute", "#ff7a7a", 17, 901, 2.9, t, view.save.settings.reducedMotion);
  ctx.restore();

  ctx.save();
  ctx.translate(376, 604 + bob(2.8) * 0.5);
  ctx.scale(1.15, 1.15);
  drawGremlin(ctx, "swarm", "#79ff9b", 12, 902, 2.6, t, view.save.settings.reducedMotion);
  ctx.restore();

  ctx.save();
  ctx.translate(246, 630 + bob(3.4) * 0.5);
  ctx.scale(1.0, 1.0);
  drawGremlin(ctx, "runner", "#ffb066", 12, 903, 2.9, t, view.save.settings.reducedMotion);
  ctx.restore();

  // Tracer doodles from the pew turret.
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.55 + i * 0.33) % 1;
    const x = 172 + k * 130;
    const y = 496 + k * 88;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,240,180,0.9)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 5);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "rgba(255,200,90,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const grad = ctx.createLinearGradient(0, 130, 0, 250);
  grad.addColorStop(0, "#c8f7ff");
  grad.addColorStop(0.55, "#6fe3ff");
  grad.addColorStop(1, "#3f9dff");
  ctx.save();
  ctx.font = font(96, 900);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(80,190,255,0.5)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = grad;
  ctx.fillText("PEW-PEW", cx, 190);
  ctx.restore();

  ctx.save();
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "10px";
  text(ctx, "DEFENSE DELUXE", cx, 252, 24, C.gold, 800, "center");
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
  ctx.restore();

  text(ctx, "the gremlins are coming. they are extremely rude.", cx, 288, 14, C.dim, 500, "center");

  for (const b of TITLE_BUTTONS) {
    const label =
      b.id === "play" ? "PLAY" : b.id === "meta" ? "GREMLIN LAB  ·  UPGRADES" : b.id === "help" ? "HOW TO PLAY" : "SETTINGS";
    const theme: Theme = b.id === "play" ? "green" : "dark";
    drawButton(ctx, b, label, null, theme, view.hover === b.id);
  }

  // Stats strip.
  const best = view.save.bestWave > 0 ? "BEST: WAVE " + view.save.bestWave : "NO RUNS YET. SUSPICIOUS.";
  text(ctx, best, cx, 668, 11, C.dim, 700, "center");
  text(
    ctx,
    "teeth " + view.save.teeth + "   ·   achievements " + view.save.achievements.length + "/" + ACHIEVEMENTS.length,
    cx,
    690,
    11,
    C.faint,
    600,
    "center",
  );
  text(ctx, "v1.0", W - 26, 690, 10, C.faint, 500, "right");
}

function drawMenuBackdrop(ctx: CanvasRenderingContext2D, time: number, reduced: boolean): void {
  drawSky(ctx, time, reduced);
  ctx.fillStyle = "rgba(4,6,14,0.55)";
  ctx.fillRect(0, 0, W, H);
}

function drawMeta(ctx: CanvasRenderingContext2D, view: View): void {
  drawMenuBackdrop(ctx, view.time, view.save.settings.reducedMotion);
  text(ctx, "GREMLIN LAB", 64, 86, 34, C.ink, 900);
  text(ctx, "spend teeth. become slightly more of a problem.", 64, 116, 12, C.dim, 500);
  tooth(ctx, W - 202, 92, 1.9);
  text(ctx, String(view.save.teeth), W - 182, 92, 26, C.gold, 900);
  text(ctx, "teeth", W - 182, 114, 9, C.faint, 700);

  panel(ctx, 60, 150, 760, 470, "rgba(12,19,34,0.92)", C.line, 14);
  META.forEach((m, i) => {
    const y = 160 + i * 108;
    const lvl = metaLevel(view.save, m.id);
    const maxed = metaMaxed(view.save, m.id);
    const cost = metaCost(view.save, m.id);
    const afford = view.save.teeth >= cost && !maxed;

    panel(ctx, 72, y, 736, 96, "rgba(17,26,45,0.9)", maxed ? alpha(C.green, 0.4) : C.line, 11);
    text(ctx, m.name, 88, y + 24, 15, C.ink, 800);
    text(ctx, m.desc, 88, y + 45, 10.5, C.dim, 500);

    for (let s = 0; s < m.max; s++) {
      const w = Math.min(26, (600 - (m.max - 1) * 4) / m.max);
      rr(ctx, 88 + s * (w + 4), y + 62, w, 8, 4);
      ctx.fillStyle = s < lvl ? C.green : "#1d2740";
      ctx.fill();
    }
    text(ctx, "LVL " + lvl + "/" + m.max, 88, y + 82, 9, C.dim, 700);

    const btn: Hit = { id: "buy:" + m.id, x: 636, y: y + 26, w: 150, h: 44 };
    drawButton(ctx, btn, maxed ? "MAXED" : "BUY · " + cost, null, maxed ? "dark" : afford ? "green" : "dark", view.hover === btn.id, !afford);
    text(ctx, "teeth", 711, y + 82, 8, C.faint, 600, "center");
  });

  panel(ctx, 840, 150, 380, 470, "rgba(12,19,34,0.92)", C.line, 14);
  text(ctx, "ACHIEVEMENTS", 860, 174, 12, C.ink, 900);
  text(ctx, view.save.achievements.length + " / " + ACHIEVEMENTS.length, 1200, 174, 10, C.dim, 700, "right");
  ACHIEVEMENTS.forEach((a, i) => {
    const y = 200 + i * 37;
    const got = view.save.achievements.includes(a.id);
    ctx.beginPath();
    ctx.arc(866, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = got ? C.green : "#1c2740";
    ctx.fill();
    if (got) text(ctx, "✓", 866, y, 8, "#04240f", 900, "center");
    text(ctx, a.name, 882, y - 5, 10.5, got ? C.ink : C.faint, 700);
    text(ctx, a.desc, 882, y + 8, 8.5, got ? C.dim : "#46536b", 500);
  });

  drawButton(ctx, BACK_BTN, "← BACK", null, "dark", view.hover === "back");
}

function drawHelp(ctx: CanvasRenderingContext2D): void {
  drawMenuBackdrop(ctx, 0, false);
  text(ctx, "HOW TO PLAY", 72, 84, 34, C.ink, 900);
  text(ctx, "you are the last line of defense between a crystal and some very rude gremlins.", 72, 116, 12, C.dim, 500);

  panel(ctx, 60, 145, 550, 470, "rgba(12,19,34,0.94)", C.line, 14);
  panel(ctx, 630, 145, 590, 470, "rgba(12,19,34,0.94)", C.line, 14);

  text(ctx, "THE LOOP", 84, 172, 13, C.cyan, 900);
  const loop = [
    "1. In the shop, pick a tower (or press 1–6).",
    "2. Click a free grid cell to build it.",
    "3. Press SPACE to unleash the wave.",
    "4. Towers shoot automatically. You supervise.",
    "5. Between waves, upgrade or sell towers.",
    "6. Survive. Cash and waves keep growing.",
    "7. Repeat until the crystal gets hugged.",
  ];
  loop.forEach((s, i) => text(ctx, s, 84, 204 + i * 26, 12, C.ink, 500));

  text(ctx, "CONTROLS", 84, 400, 13, C.cyan, 900);
  const controls: [string, string][] = [
    ["1 – 6", "pick a tower"],
    ["SPACE", "start wave / pause"],
    ["F", "1x / 2x speed"],
    ["ESC", "pause, cancel placement"],
    ["CLICK TOWER", "inspect + retarget"],
    ["M", "mute"],
  ];
  controls.forEach(([k, v], i) => {
    const y = 430 + i * 27;
    panel(ctx, 84, y - 11, 96, 22, "#16203a", C.line, 6);
    text(ctx, k, 132, y, 9, C.gold, 800, "center");
    text(ctx, v, 194, y, 11, C.ink, 500);
  });

  text(ctx, "TIPS FROM THE LAB", 656, 172, 13, C.pink, 900);
  const tips = [
    "Brutes split into two smaller gremlins when killed.",
    "Frost towers barely tickle, but they slow everything.",
    "Tesla coils chain to up to 4 enemies. Clumps hate them.",
    "YEET cannons splash. Put them where lines bunch up.",
    "The nanny has huge range and instant-hit damage.",
    "Selling returns 60% of everything you invested.",
    "Targeting modes matter: 'first' stops leaks.",
    "Bosses every 5 waves cost 10 hugs if they get through.",
    "Teeth are permanent. Spend them in the Gremlin Lab.",
    "Double speed also doubles your mistakes.",
  ];
  tips.forEach((s, i) => {
    ctx.beginPath();
    ctx.arc(668, 204 + i * 40, 3, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? C.cyan : C.pink;
    ctx.fill();
    text(ctx, s, 682, 204 + i * 40, 11, C.ink, 500);
  });

  drawButton(ctx, BACK_BTN, "← BACK", null, "dark", false);
}

function drawSettings(ctx: CanvasRenderingContext2D, view: View): void {
  drawMenuBackdrop(ctx, view.time, view.save.settings.reducedMotion);
  text(ctx, "SETTINGS", 72, 84, 34, C.ink, 900);
  text(ctx, "the gremlins do not have a settings menu. you do.", 72, 116, 12, C.dim, 500);

  const s = view.save.settings;
  const rows: { id: string; label: string; sub: string; on: boolean }[] = [
    { id: "toggle-mute", label: "Sound effects", sub: "pew pew, but optional", on: !s.muted },
    { id: "toggle-music", label: "Music", sub: "extremely chill space arpeggios", on: s.music },
    { id: "toggle-motion", label: "Reduced motion", sub: "less bobbing and twinkling", on: s.reducedMotion },
  ];

  rows.forEach((r) => {
    const b = SETTINGS_BUTTONS.find((x) => x.id === r.id)!;
    const isHover = view.hover === r.id;
    panel(ctx, b.x, b.y, b.w, b.h, isHover ? "#16233c" : "rgba(17,26,45,0.95)", isHover ? C.cyan : C.line, 11);
    text(ctx, r.label, b.x + 18, b.y + b.h / 2 - 7, 14, C.ink, 700);
    text(ctx, r.sub, b.x + 18, b.y + b.h / 2 + 11, 9.5, C.dim, 500);
    panel(ctx, b.x + b.w - 96, b.y + 12, 78, 30, r.on ? "rgba(24,120,72,0.9)" : "rgba(60,26,36,0.9)", r.on ? C.green : C.pink, 8);
    text(ctx, r.on ? "ON" : "OFF", b.x + b.w - 57, b.y + 27, 11, r.on ? C.green : C.pink, 900, "center");
  });

  const reset = SETTINGS_BUTTONS.find((x) => x.id === "reset")!;
  panel(ctx, reset.x, reset.y, reset.w, reset.h, view.resetArmed ? "rgba(90,20,36,0.95)" : "rgba(30,18,26,0.9)", view.resetArmed ? C.pink : "#5a2a3a", 10);
  text(ctx, view.resetArmed ? "CLICK AGAIN TO WIPE ALL PROGRESS" : "Reset all progress", W / 2, reset.y + reset.h / 2, 11, view.resetArmed ? C.pink : C.dim, 700, "center");

  drawButton(ctx, BACK_BTN, "← BACK", null, "dark", view.hover === "back");
  text(ctx, "Progress is saved in this browser.", 72, 690, 10, C.faint, 500);
}

function drawPause(ctx: CanvasRenderingContext2D, view: View): void {
  ctx.fillStyle = "rgba(3,5,12,0.72)";
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 250, 180, 500, 360, "rgba(12,19,34,0.98)", alpha(C.cyan, 0.35), 18);
  shadowText(ctx, "SNACK BREAK", W / 2, 250, 34, C.cyan, 900, "center");
  text(ctx, "the gremlins are also having a snack", W / 2, 288, 11, C.dim, 500, "center");
  for (const b of PAUSE_BUTTONS) {
    const label = b.id === "resume" ? "RESUME" : b.id === "restart" ? "RESTART RUN" : "QUIT TO TITLE";
    drawButton(ctx, b, label, null, b.id === "resume" ? "green" : "dark", view.hover === b.id);
  }
}

function drawGameOver(ctx: CanvasRenderingContext2D, g: Game, view: View): void {
  ctx.fillStyle = "rgba(4,4,10,0.8)";
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 260, 80, 760, 580, "rgba(15,10,22,0.98)", alpha(C.pink, 0.35), 20);

  shadowText(ctx, "BASE GOT SNACC'D!", W / 2, 142, 40, C.pink, 900, "center");
  text(ctx, "the gremlins are doing victory laps right now", W / 2, 181, 12, C.dim, 500, "center");

  const stats: [string, string][] = [
    ["WAVE REACHED", String(g.wave)],
    ["GREMLINS YEETED", String(g.stats.kills)],
    ["HUGS LOST", String(g.stats.leaks)],
    ["CASH EARNED", formatMoney(g.stats.cashEarned)],
  ];
  stats.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 320 + col * 330;
    const y = 232 + row * 74;
    panel(ctx, x, y, 300, 60, "rgba(24,18,36,0.9)", C.line, 10);
    text(ctx, k, x + 14, y + 19, 8.5, C.dim, 800);
    text(ctx, v, x + 14, y + 41, 22, C.ink, 900);
  });

  if (view.gameover) {
    const go = view.gameover;
    panel(ctx, 320, 392, 300, 64, "rgba(40,30,10,0.8)", alpha(C.gold, 0.4), 10);
    text(ctx, "TEETH EARNED", 334, 412, 8.5, C.dim, 800);
    text(ctx, "+" + go.teeth, 334, 434, 22, C.gold, 900);
    text(ctx, "spend in the Gremlin Lab", 606, 424, 9, C.faint, 600, "right");

    if (go.best) {
      panel(ctx, 640, 392, 300, 64, "rgba(20,50,30,0.85)", alpha(C.green, 0.45), 10);
      text(ctx, "NEW PERSONAL BEST", 654, 412, 8.5, C.dim, 800);
      text(ctx, "WAVE " + g.wave, 654, 434, 22, C.green, 900);
    } else {
      text(ctx, "personal best: wave " + view.save.bestWave, 940, 424, 10, C.dim, 600, "right");
    }

    if (go.unlocked.length > 0) {
      const names = go.unlocked
        .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id)
        .join(" · ");
      text(ctx, "UNLOCKED: " + names, W / 2, 498, 10, C.gold, 700, "center");
    } else {
      text(ctx, "no new achievements. the lab is disappointed.", W / 2, 498, 10, C.faint, 500, "center");
    }
  }

  for (const b of GAMEOVER_BUTTONS) {
    const label = b.id === "retry" ? "RETRY" : b.id === "gameover-meta" ? "UPGRADES" : "TITLE";
    const theme: Theme = b.id === "retry" ? "green" : "dark";
    drawButton(ctx, b, label, null, theme, view.hover === b.id);
  }
}

function drawToast(ctx: CanvasRenderingContext2D, toast: { text: string; life: number; maxLife: number }): void {
  const k = toast.life / toast.maxLife;
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 3);
  panel(ctx, W / 2 - 220, 76, 440, 42, "rgba(30,26,10,0.96)", alpha(C.gold, 0.6), 10);
  text(ctx, "★", W / 2 - 190, 97, 16, C.gold, 900, "center");
  text(ctx, toast.text, W / 2 + 12, 97, 12, C.gold, 800, "center");
  ctx.restore();
}
