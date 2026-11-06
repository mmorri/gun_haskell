import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("http://localhost:8123/?debug", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.mouse.click(640, 404);
await page.waitForTimeout(500);
await page.evaluate(() => window.__pew.grantCash(2000));
await page.mouse.click(1100, 143);
await page.mouse.click(270, 374);
await page.waitForTimeout(2200);
await page.mouse.click(1100, 567);
await page.waitForTimeout(5000);
const st = await page.evaluate(() => window.__pew.state());
console.log("packaged smoke:", JSON.stringify({ phase: st.phase, wave: st.wave, kills: st.kills, towers: st.towers.length, lives: st.lives, errors }));
await page.screenshot({ path: "/tmp/itch-packaged.png" });
await browser.close();
