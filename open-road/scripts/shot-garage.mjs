/**
 * Side-view freecam screenshots of every garage car.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const OUT = "/opt/cursor/artifacts/garage-sides";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  userDataDir: "/tmp/chrome-garage-shots",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=1280,720",
  ],
  defaultViewport: { width: 1280, height: 720 },
});

const page = await browser.newPage();
page.setDefaultTimeout(60000);
await page.goto("http://localhost:5173/", { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(() => window.__driveGame, { timeout: 20000 });

await page.evaluate(async () => {
  const game = window.__driveGame;
  document.querySelector("#play")?.click();
  await game.start();
  game.setSideFreecam?.(9, 1.8);
});

await new Promise((r) => setTimeout(r, 900));

const FALLBACK = [
  "lambchop-chupacabra",
  "lambchop-minotaur",
  "lambchop-bonehorn",
  "shovel-a-thresher",
  "shovel-a-megalodon",
  "shovel-a-mastodon",
  "beep-sabertooth",
  "baguetti-hellhound",
  "baguetti-cerberus",
  "ferocity-jackal",
  "ferocity-manticore",
  "porch-deathstalker",
  "porch-hellbender",
  "mcroar-pterodactyl",
  "mcroar-great-white",
  "king-egg-leviathan",
];

const carIds = FALLBACK;

for (const id of carIds) {
  await page.evaluate(async (carId) => {
    const game = window.__driveGame;
    await game.switchCar(carId);
    game.reset?.();
    game.setSideFreecam?.(9, 1.8);
  }, id);
  await new Promise((r) => setTimeout(r, 1400));
  const file = `${OUT}/${id}.png`;
  await page.screenshot({ path: file });
  console.log("shot", id, file);
}

await browser.close();
console.log("done", carIds.length);
