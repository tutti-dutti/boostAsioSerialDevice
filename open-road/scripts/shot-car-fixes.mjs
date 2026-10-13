/**
 * Side + rear freecam shots for every CAR-FIXES vehicle.
 * Uses process.exit to avoid Chrome close EAGAIN flakiness.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "/opt/cursor/artifacts/car-fixes";
mkdirSync(OUT, { recursive: true });

const CARS = [
  "lambchop-chupacabra",
  "lambchop-minotaur",
  "lambchop-bonehorn",
  "shovel-a-thresher",
  "porch-deathstalker",
  "mcroar-great-white",
  "voltra-ankylosaur",
  "river-run-swamp-beast",
  "coyota-tasmanian-devil",
  "headbutt-mammoth",
  "bummer-war-hippo",
];

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "shell",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-gpu-sandbox",
    "--window-size=1280,720",
  ],
  defaultViewport: { width: 1280, height: 720 },
});

const page = await browser.newPage();
page.setDefaultTimeout(90000);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => window.__driveGame, { timeout: 45000 });

await page.evaluate(async () => {
  document.querySelector("#play")?.click();
  await window.__driveGame.start();
});
await new Promise((r) => setTimeout(r, 1200));

for (const id of CARS) {
  await page.evaluate(async (carId) => {
    const game = window.__driveGame;
    await game.switchCar(carId);
    game.reset?.();
    game.setSideFreecam?.(10, 2.0);
  }, id);
  await new Promise((r) => setTimeout(r, 1400));
  const side = await page.screenshot({ encoding: "binary" });
  writeFileSync(`${OUT}/${id}-side.png`, side);
  console.log("side", id);

  await page.evaluate(() => window.__driveGame.setRearFreecam?.(11, 2.4));
  await new Promise((r) => setTimeout(r, 800));
  const rear = await page.screenshot({ encoding: "binary" });
  writeFileSync(`${OUT}/${id}-rear.png`, rear);
  console.log("rear", id);
}

if (errors.length) console.log("errors", errors.slice(0, 5));
console.log("done", CARS.length * 2);
process.exit(0);
