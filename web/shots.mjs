import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

mkdirSync("../docs/screenshots", { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true });

async function newPage(q = "?debug") {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto("http://localhost:8099/" + q, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  return page;
}

const shot = (page, name) => page.screenshot({ path: `../docs/screenshots/${name}.png` });

const build = [
  [143, 270, 374], // pew
  [195, 150, 254], // brrrt
  [247, 550, 294], // nanny
  [299, 390, 414], // yeet
  [351, 430, 294], // frost
  [403, 670, 294], // tesla
  [143, 790, 494], // pew
  [351, 670, 494], // frost
  [195, 310, 414], // brrrt
  [247, 630, 254], // nanny
  [143, 430, 374], // pew
  [299, 150, 374], // yeet
];

async function buildAll(page, wave) {
  await page.mouse.click(640, 404);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__pew.grantCash(9000));
  await page.evaluate((w) => window.__pew.setWave(w), wave);
  for (const [cardY, x, y] of build) {
    await page.mouse.click(1100, cardY);
    await page.mouse.click(x, y);
    await page.waitForTimeout(80);
  }
  // Upgrade the first pew three times for the star display.
  await page.mouse.click(270, 374);
  await page.waitForTimeout(200);
  for (let i = 0; i < 3; i++) {
    await page.mouse.click(1100, 420);
    await page.waitForTimeout(150);
  }
  await page.mouse.click(1218, 112);
  await page.waitForTimeout(200);
  await page.mouse.click(700, 620, { button: "right" });
}

// 1. Title
let page = await newPage();
await shot(page, "title");
await page.close();

// 2. Help
page = await newPage();
await page.mouse.click(640, 542);
await page.waitForTimeout(400);
await shot(page, "help");
await page.close();

// 3. Shop + action
page = await newPage();
await buildAll(page, 7);
await page.waitForTimeout(500);
await shot(page, "shop");

await page.mouse.click(1100, 567);
await page.waitForTimeout(6500);
await shot(page, "combat");
await page.waitForTimeout(2500);
await shot(page, "combat2");

await page.keyboard.press("Escape");
await page.waitForTimeout(350);
await shot(page, "pause");
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

await page.evaluate(() => window.__pew.forceOver());
await page.waitForTimeout(700);
await shot(page, "gameover");

await page.evaluate(() => window.__pew.grantTeeth(420));
await page.mouse.click(640, 611);
await page.waitForTimeout(400);
await shot(page, "meta");
await page.close();

// 4. Boss wave
page = await newPage();
await buildAll(page, 10);
await page.mouse.click(1100, 567);
await page.keyboard.press("f");
for (let i = 0; i < 90; i++) {
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__pew.state());
  if (st.bossX > 360) break;
}
await page.waitForTimeout(400);
await shot(page, "boss");
await page.close();

await browser.close();
