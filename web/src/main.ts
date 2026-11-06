import { loadSprites, type Sprites } from "./assets";
import { AudioEngine, type SfxName } from "./audio";
import { H, MAX_LEVEL, TOWERS, W, dist, type MetaId, type TowerKind, type Vec } from "./config";
import { render } from "./draw";
import {
  addText,
  bulletsHit,
  bulletsMade,
  cellAt,
  shotsFired,
  debugTowerRanges,
  createGame,
  cycleTarget,
  placeTower,
  placementError,
  runSummary,
  sellTower,
  startWave,
  update,
  upgradeTower,
} from "./game";
import { addAchievements, loadSave, metaCost, metaLevel, metaMaxed, resetSave, writeSave } from "./save";
import type { Game, SaveData } from "./types";
import {
  BACK_BTN,
  BOARD_HIT,
  GAMEOVER_BUTTONS,
  PAUSE_BUTTONS,
  SETTINGS_BUTTONS,
  TITLE_BUTTONS,
  metaButtons,
  playingButtons,
  findHit,
  hit,
  type Hit,
  type Screen,
} from "./ui";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const boot = document.getElementById("boot");
const ctx = canvas.getContext("2d", { alpha: false })!;

let save: SaveData = loadSave();
let game: Game = createGame(save);
let audio = new AudioEngine(save.settings.muted, save.settings.music);
let screen: Screen = "title";
let hover: string | null = null;
let mouse: Vec = { x: 0, y: 0 };
let uiTime = 0;
let resetArmedUntil = 0;
let gameoverInfo: { teeth: number; best: boolean; unlocked: string[] } | null = null;
let toast: { text: string; life: number; maxLife: number } | null = null;
let lastFrame = performance.now();

function setGame(next: Game): void {
  next.onEvent = (name) => audio.sfx(name as SfxName, 0);
  game = next;
}

setGame(game);

// ---------------------------------------------------------------------------
// Canvas scaling
// ---------------------------------------------------------------------------

function fitCanvas(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * scale) + "px";
  canvas.style.height = Math.floor(H * scale) + "px";
}

window.addEventListener("resize", fitCanvas);
fitCanvas();

function pointerPos(e: PointerEvent): Vec {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * W,
    y: ((e.clientY - r.top) / r.height) * H,
  };
}

// ---------------------------------------------------------------------------
// Buttons per screen
// ---------------------------------------------------------------------------

function activeButtons(): Hit[] {
  switch (screen) {
    case "title":
      return TITLE_BUTTONS;
    case "meta":
      return metaButtons(save);
    case "help":
      return [BACK_BTN];
    case "settings":
      return SETTINGS_BUTTONS;
    case "gameover":
      return GAMEOVER_BUTTONS;
    case "playing":
      return game.paused ? PAUSE_BUTTONS : playingButtons(game);
  }
}

function updatePointer(p: Vec): void {
  mouse = p;
  game.mouse = p;
  const b = findHit(activeButtons(), p.x, p.y);
  hover = b?.id ?? null;

  if (screen === "playing" && game.placing) {
    const cell = cellAt(p);
    game.hover = cell;
  } else {
    game.hover = null;
  }

  const overTower =
    screen === "playing" &&
    !game.paused &&
    game.towers.some((t) => dist(t.pos, p) < 24);
  canvas.style.cursor = hover || overTower ? "pointer" : game.placing ? "crosshair" : "default";
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function newRun(): void {
  gameoverInfo = null;
  setGame(createGame(save));
  screen = "playing";
  audio.unlock();
  audio.sfx("click");
}

function commitBest(): void {
  if (game.wave > save.bestWave) {
    save = { ...save, bestWave: game.wave };
    writeSave(save);
  }
}

function endRun(): void {
  const summary = runSummary(game, save);
  const oldBest = save.bestWave;
  const withStuff = addAchievements(save, summary.achievements);
  save = {
    ...withStuff.save,
    teeth: save.teeth + summary.teeth,
    bestWave: Math.max(save.bestWave, game.wave),
    bestKills: Math.max(save.bestKills, game.stats.kills),
    runs: save.runs + 1,
  };
  writeSave(save);
  gameoverInfo = { teeth: summary.teeth, best: game.wave > oldBest, unlocked: withStuff.unlocked };
  screen = "gameover";
  if (withStuff.unlocked.length > 0) {
    toast = { text: "Achievement unlocked: " + withStuff.unlocked.length + " new", life: 3, maxLife: 3 };
  }
}

function showToast(text: string): void {
  toast = { text, life: 1.8, maxLife: 1.8 };
}

function shortError(err: string): string {
  if (err === "that's the gremlin road") return "not on the road!";
  if (err === "tower already here") return "occupied!";
  if (err === "not enough cash") return "need cash!";
  return err;
}

function buyMeta(id: string): void {
  const key = id as MetaId;
  const def = metaCost(save, key);
  if (metaMaxed(save, key) || save.teeth < def) {
    audio.sfx("click");
    return;
  }
  save = {
    ...save,
    teeth: save.teeth - def,
    meta: { ...save.meta, [id]: metaLevel(save, key) + 1 },
  };
  writeSave(save);
  audio.sfx("upgrade");
  toast = { text: "Lab upgrade purchased", life: 1.8, maxLife: 1.8 };
}

function doReset(): void {
  save = resetSave();
  audio.setMuted(save.settings.muted);
  audio.setMusic(save.settings.music);
  setGame(createGame(save));
  screen = "title";
  resetArmedUntil = 0;
  toast = { text: "All progress wiped. Fresh gremlins.", life: 2.4, maxLife: 2.4 };
}

function togglePause(): void {
  if (screen !== "playing" || game.phase === "gameover") return;
  game.paused = !game.paused;
  audio.sfx("click");
}

function handleClick(p: Vec): void {
  const btn = findHit(activeButtons(), p.x, p.y);
  if (btn) {
    handleButton(btn.id);
    return;
  }
  if (screen !== "playing" || game.paused) return;

  if (hit(BOARD_HIT, p.x, p.y)) {
    if (game.placing) {
      const cell = cellAt(p);
      if (cell) {
        const err = placementError(game, game.placing, cell);
        const placed = placeTower(game, game.placing, cell);
        if (placed) {
          if (!shiftDown) game.placing = null;
          game.hover = cell;
        } else if (err) {
          addText(game, cell.x, cell.y - 10, shortError(err), "#ff8fa6", 1.1, 12);
          audio.sfx("click");
        }
      }
      return;
    }
    let best: { id: number; d: number } | null = null;
    for (const t of game.towers) {
      const d = dist(t.pos, p);
      if (d < 24 && (!best || d < best.d)) best = { id: t.id, d };
    }
    if (best) {
      game.selected = best.id;
      audio.sfx("select");
    } else {
      game.selected = null;
    }
    return;
  }
}

function handleButton(id: string): void {
  audio.unlock();
  if (id.startsWith("tower:")) {
    const kind = id.slice(6) as TowerKind;
    if (game.placing !== kind) {
      const cost = TOWERS.find((t) => t.kind === kind)!.cost;
      if (game.cash < cost) {
        showToast("Not enough cash — need $" + cost);
        audio.sfx("click");
        return;
      }
    }
    game.placing = game.placing === kind ? null : kind;
    game.selected = null;
    audio.sfx("select");
    return;
  }
  if (id.startsWith("buy:")) {
    buyMeta(id.slice(4));
    return;
  }
  switch (id) {
    case "play":
      newRun();
      break;
    case "meta":
      screen = "meta";
      audio.sfx("click");
      break;
    case "help":
      screen = "help";
      audio.sfx("click");
      break;
    case "settings":
      screen = "settings";
      audio.sfx("click");
      break;
    case "back":
      screen = "title";
      audio.sfx("click");
      break;
    case "start":
      if (game.phase === "shop") startWave(game);
      break;
    case "speed":
      game.speed = game.speed > 1 ? 1 : 2;
      audio.sfx("click");
      break;
    case "pause":
    case "menu":
      togglePause();
      break;
    case "mute":
      save = { ...save, settings: { ...save.settings, muted: !save.settings.muted } };
      writeSave(save);
      audio.setMuted(save.settings.muted);
      break;
    case "upgrade":
      if (game.selected !== null) {
        if (upgradeTower(game, game.selected)) {
          if (game.towers.find((t) => t.id === game.selected)?.level === MAX_LEVEL) {
            toast = { text: "Tower maxed. It is now insufferable.", life: 2, maxLife: 2 };
          }
        } else {
          audio.sfx("click");
        }
      }
      break;
    case "sell":
      if (game.selected !== null) sellTower(game, game.selected);
      break;
    case "target":
      if (game.selected !== null) cycleTarget(game, game.selected);
      break;
    case "close":
      game.selected = null;
      audio.sfx("click");
      break;
    case "resume":
      game.paused = false;
      audio.sfx("click");
      break;
    case "restart":
      commitBest();
      newRun();
      break;
    case "quit":
      commitBest();
      game.paused = false;
      screen = "title";
      audio.sfx("click");
      break;
    case "retry":
      newRun();
      break;
    case "gameover-meta":
      screen = "meta";
      audio.sfx("click");
      break;
    case "gameover-title":
      screen = "title";
      audio.sfx("click");
      break;
    case "toggle-mute":
      save = { ...save, settings: { ...save.settings, muted: !save.settings.muted } };
      writeSave(save);
      audio.setMuted(save.settings.muted);
      audio.sfx("click");
      break;
    case "toggle-music":
      save = { ...save, settings: { ...save.settings, music: !save.settings.music } };
      writeSave(save);
      audio.setMusic(save.settings.music);
      audio.sfx("click");
      break;
    case "toggle-motion":
      save = { ...save, settings: { ...save.settings, reducedMotion: !save.settings.reducedMotion } };
      writeSave(save);
      audio.sfx("click");
      break;
    case "reset":
      if (performance.now() < resetArmedUntil) doReset();
      else {
        resetArmedUntil = performance.now() + 4000;
        audio.sfx("click");
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

let shiftDown = false;

canvas.addEventListener("pointermove", (e) => {
  updatePointer(pointerPos(e));
});

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  audio.unlock();
  const p = pointerPos(e);
  updatePointer(p);

  if (e.button === 2) {
    game.placing = null;
    game.selected = null;
    return;
  }
  if (e.button !== 0) return;
  handleClick(p);
});

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  game.placing = null;
  game.selected = null;
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Shift") shiftDown = true;
  const k = e.key.toLowerCase();

  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
  audio.unlock();

  if (k === "m") {
    save = { ...save, settings: { ...save.settings, muted: !save.settings.muted } };
    writeSave(save);
    audio.setMuted(save.settings.muted);
    return;
  }

  if (k === "escape") {
    if (screen === "playing") {
      if (game.placing) game.placing = null;
      else if (game.selected !== null) game.selected = null;
      else togglePause();
    } else if (screen !== "title") {
      screen = "title";
    }
    return;
  }

  if (screen !== "playing") return;

  if (k === " ") {
    if (game.paused) {
      game.paused = false;
      return;
    }
    if (game.phase === "shop") startWave(game);
    else if (game.phase === "combat") togglePause();
    return;
  }

  if (k === "f") {
    game.speed = game.speed > 1 ? 1 : 2;
    audio.sfx("click");
    return;
  }

  if (game.phase === "shop" && k >= "1" && k <= "6") {
    const t = TOWERS[Number(k) - 1];
    if (t) {
      game.placing = game.placing === t.kind ? null : t.kind;
      game.selected = null;
      audio.sfx("select");
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "Shift") shiftDown = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "playing" && game.phase === "combat") game.paused = true;
});

window.addEventListener("pagehide", () => {
  commitBest();
});

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  uiTime += dt;

  if (toast) {
    toast.life -= dt;
    if (toast.life <= 0) toast = null;
  }

  update(game, dt);
  if (game.phase === "gameover" && screen === "playing") endRun();

  render(ctx, game, sprites, {
    screen,
    save,
    hover,
    time: uiTime,
    resetArmed: performance.now() < resetArmedUntil,
    gameover: gameoverInfo,
    toast,
  });

  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

let sprites = {} as Sprites;

// Debug hook, opt-in with ?debug. Handy for automated smoke tests.
if (new URLSearchParams(location.search).has("debug")) {
  (window as unknown as { __pew: unknown }).__pew = {
    state: () => ({
      screen,
      phase: game.phase,
      cash: game.cash,
      lives: game.lives,
      wave: game.wave,
      towers: game.towers.map((t) => ({ kind: t.kind, x: t.pos.x, y: t.pos.y, level: t.level })),
      enemies: game.enemies.length,
      queued: game.queue.length,
      kills: game.stats.kills,
      boss: game.enemies.some((e) => e.boss),
      bossX: game.enemies.find((e) => e.boss)?.pos.x ?? -1,
      shots: shotsFired,
      made: bulletsMade,
      hits: bulletsHit,
      towerState: debugTowerRanges(game),
      enemyState: game.enemies.slice(0, 4).map((e) => ({ kind: e.kind, x: Math.round(e.pos.x), y: Math.round(e.pos.y), hp: Math.round(e.hp), alive: e.alive })),
      save,
    }),
    forceOver: () => {
      game.stats.kills = 87;
      game.stats.leaks = 9;
      game.stats.cashEarned = 412;
      game.wave = 7;
      game.lives = 0;
      game.phase = "gameover";
    },
    grantTeeth: (n: number) => {
      save = { ...save, teeth: save.teeth + n };
      writeSave(save);
    },
    grantCash: (n: number) => {
      game.cash += n;
    },
    setWave: (n: number) => {
      game.wave = n;
    },
  };
}

async function bootGame(): Promise<void> {
  sprites = await loadSprites();
  if (boot) boot.classList.add("hidden");
  requestAnimationFrame((t) => {
    lastFrame = t;
    frame(t);
  });
}

void bootGame();
