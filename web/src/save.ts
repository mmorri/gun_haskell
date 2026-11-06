import { META, type MetaId } from "./config";
import type { SaveData } from "./types";

const KEY = "pewpew-defense-save-v1";

export function defaultSave(): SaveData {
  return {
    v: 1,
    bestWave: 0,
    bestKills: 0,
    teeth: 0,
    meta: { damage: 0, cash: 0, lives: 0, bounty: 0 },
    achievements: [],
    settings: { muted: false, music: true, reducedMotion: false },
    runs: 0,
  };
}

export function loadSave(): SaveData {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...base,
      ...parsed,
      meta: { ...base.meta, ...(parsed.meta ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    };
  } catch {
    return base;
  }
}

export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode / blocked storage: the game still runs, progress just won't stick.
  }
}

export function resetSave(): SaveData {
  const fresh = defaultSave();
  writeSave(fresh);
  return fresh;
}

export function metaLevel(save: SaveData, id: MetaId): number {
  return save.meta[id] ?? 0;
}

export function metaCost(save: SaveData, id: MetaId): number {
  const def = META.find((m) => m.id === id);
  if (!def) return Infinity;
  return def.cost(metaLevel(save, id));
}

export function metaMaxed(save: SaveData, id: MetaId): boolean {
  const def = META.find((m) => m.id === id);
  return !def || metaLevel(save, id) >= def.max;
}

export function metaEffects(save: SaveData) {
  return {
    damageMult: 1 + 0.04 * metaLevel(save, "damage"),
    startCash: 20 * metaLevel(save, "cash"),
    startLives: 2 * metaLevel(save, "lives"),
    cashMult: 1 + 0.05 * metaLevel(save, "bounty"),
  };
}

export function addAchievements(save: SaveData, ids: string[]): { save: SaveData; unlocked: string[] } {
  const unlocked = ids.filter((id) => !save.achievements.includes(id));
  if (unlocked.length === 0) return { save, unlocked };
  return { save: { ...save, achievements: [...save.achievements, ...unlocked] }, unlocked };
}
