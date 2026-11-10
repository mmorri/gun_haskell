import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true });

async function fresh() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto("http://localhost:8099/?debug", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  return page;
}

const towers = [
  [143, 195, 254],
  [195, 247, 254],
  [143, 300, 294],
  [195, 247, 414],
  [299, 390, 414],
  [351, 430, 294],
];

async function setup(page, wave) {
  await page.mouse.click(640, 404);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__pew.grantCash(9000));
  await page.evaluate((w) => window.__pew.setWave(w), wave);
  for (const [cardY, x, y] of towers) {
    await page.mouse.click(1100, cardY);
    await page.mouse.click(x, y);
    await page.waitForTimeout(80);
  }
  await page.mouse.click(700, 620, { button: "right" });
  await page.waitForTimeout(150);
  await page.mouse.click(1200, 567);
  await page.waitForTimeout(7000);
}

// --- Marines shot -----------------------------------------------------------
let page = await fresh();
await setup(page, 14);
await page.evaluate(() => window.__pew.dropMarines(285, 255));
await page.waitForTimeout(750);
await page.screenshot({ path: "../docs/screenshots/superpowers.png" });
await page.close();

// --- A-10 shot (aiming preview) ---------------------------------------------
page = await fresh();
await setup(page, 14);
await page.keyboard.press("q");
await page.mouse.click(260, 470);
await page.mouse.move(560, 470);
await page.waitForTimeout(350);
await page.screenshot({ path: "../docs/screenshots/a10.png" });
await page.close();

await browser.close();
