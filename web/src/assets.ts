export interface Sprites {
  pewBase: HTMLImageElement | null;
  pewBarrel: HTMLImageElement | null;
  nannyBase: HTMLImageElement | null;
  nannyBarrel: HTMLImageElement | null;
  brrrt: HTMLImageElement | null;
  yeet: HTMLImageElement | null;
  swarm: HTMLImageElement | null;
  runner: HTMLImageElement | null;
  brute: HTMLImageElement | null;
  bullet: HTMLImageElement | null;
  bulletHeavy: HTMLImageElement | null;
  flame: HTMLImageElement | null;
  portal: HTMLImageElement | null;
  crystal: HTMLImageElement | null;
}

const FILES: Record<keyof Sprites, string> = {
  pewBase: "towerDefense_tile228.png",
  pewBarrel: "towerDefense_tile292.png",
  nannyBase: "towerDefense_tile229.png",
  nannyBarrel: "towerDefense_tile291.png",
  brrrt: "towerDefense_tile204.png",
  yeet: "towerDefense_tile205.png",
  swarm: "towerDefense_tile245.png",
  runner: "towerDefense_tile247.png",
  brute: "towerDefense_tile250.png",
  bullet: "towerDefense_tile272.png",
  bulletHeavy: "towerDefense_tile274.png",
  flame: "towerDefense_tile296.png",
  portal: "towerDefense_tile133.png",
  crystal: "towerDefense_tile180.png",
};

function loadOne(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadSprites(): Promise<Sprites> {
  const base = "assets/kenney/";
  const keys = Object.keys(FILES) as (keyof Sprites)[];
  const images = await Promise.all(keys.map((k) => loadOne(base + FILES[k])));
  const out = {} as Sprites;
  keys.forEach((k, i) => {
    out[k] = images[i];
  });
  return out;
}
