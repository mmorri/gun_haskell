import { BOARD, HUD_H, META, SIDEBAR, TOWERS, W } from "./config";
import type { Game, SaveData } from "./types";

export type Screen = "title" | "playing" | "meta" | "help" | "settings" | "gameover";

export interface Hit {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function hit(r: Hit, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function findHit(hits: Hit[], x: number, y: number): Hit | null {
  for (let i = hits.length - 1; i >= 0; i--) if (hit(hits[i], x, y)) return hits[i];
  return null;
}

// ---------------------------------------------------------------------------
// In-game layout
// ---------------------------------------------------------------------------

export const CARD_X = SIDEBAR.x + 12;
export const CARD_W = SIDEBAR.w - 24;
export const CARD_H = 46;

export function towerCards(): Hit[] {
  return TOWERS.map((t, i) => ({
    id: "tower:" + t.kind,
    x: CARD_X,
    y: 120 + i * 52,
    w: CARD_W,
    h: CARD_H,
  }));
}

export const START_BTN: Hit = { id: "start", x: CARD_X, y: 538, w: CARD_W, h: 58 };

export const HUD_BUTTONS: Hit[] = [
  { id: "speed", x: 980, y: 14, w: 72, h: 36 },
  { id: "pause", x: 1060, y: 14, w: 72, h: 36 },
  { id: "mute", x: 1140, y: 14, w: 52, h: 36 },
  { id: "menu", x: 1200, y: 14, w: 68, h: 36 },
];

export const PAUSE_BUTTONS: Hit[] = [
  { id: "resume", x: W / 2 - 140, y: 322, w: 280, h: 54 },
  { id: "restart", x: W / 2 - 140, y: 388, w: 280, h: 54 },
  { id: "quit", x: W / 2 - 140, y: 454, w: 280, h: 54 },
];

export function inspectorButtons(g: Game): Hit[] {
  const x = SIDEBAR.x + 16;
  const w = SIDEBAR.w - 32;
  const tower = g.towers.find((t) => t.id === g.selected);
  if (!tower) return [];
  return [
    { id: "target", x, y: 334, w, h: 50 },
    { id: "upgrade", x, y: 394, w, h: 52 },
    { id: "sell", x, y: 456, w, h: 46 },
    { id: "close", x: SIDEBAR.x + SIDEBAR.w - 52, y: 92, w: 40, h: 40 },
  ];
}

export function playingButtons(g: Game): Hit[] {
  const selected = g.towers.some((t) => t.id === g.selected);
  return [...HUD_BUTTONS, ...(selected ? inspectorButtons(g) : towerCards()), ...(selected ? [] : [START_BTN])];
}

// ---------------------------------------------------------------------------
// Static screens
// ---------------------------------------------------------------------------

export const TITLE_BUTTONS: Hit[] = [
  { id: "play", x: W / 2 - 150, y: 372, w: 300, h: 64 },
  { id: "meta", x: W / 2 - 150, y: 452, w: 300, h: 52 },
  { id: "help", x: W / 2 - 150, y: 516, w: 300, h: 52 },
  { id: "settings", x: W / 2 - 150, y: 580, w: 300, h: 52 },
];

export const BACK_BTN: Hit = { id: "back", x: 48, y: 650, w: 150, h: 48 };

export function metaButtons(save: SaveData): Hit[] {
  const out: Hit[] = [BACK_BTN];
  META.forEach((m, i) => {
    out.push({ id: "buy:" + m.id, x: 1036, y: 176 + i * 108, w: 150, h: 44 });
  });
  return out;
}

export const SETTINGS_BUTTONS: Hit[] = [
  { id: "toggle-mute", x: W / 2 - 240, y: 236, w: 480, h: 54 },
  { id: "toggle-music", x: W / 2 - 240, y: 306, w: 480, h: 54 },
  { id: "toggle-motion", x: W / 2 - 240, y: 376, w: 480, h: 54 },
  { id: "reset", x: W / 2 - 240, y: 470, w: 480, h: 50 },
  { id: "back", x: 48, y: 650, w: 150, h: 48 },
];

export const GAMEOVER_BUTTONS: Hit[] = [
  { id: "retry", x: W / 2 - 260, y: 560, w: 160, h: 56 },
  { id: "gameover-meta", x: W / 2 - 80, y: 560, w: 160, h: 56 },
  { id: "gameover-title", x: W / 2 + 100, y: 560, w: 160, h: 56 },
];

// The playing board is the left region; the sidebar has its own hit zones.
export const BOARD_HIT: Hit = { id: "board", x: BOARD.x, y: BOARD.y, w: BOARD.w, h: BOARD.h };
export const SIDEBAR_HIT: Hit = { id: "sidebar", x: SIDEBAR.x, y: HUD_H, w: SIDEBAR.w, h: SIDEBAR.h - HUD_H };
