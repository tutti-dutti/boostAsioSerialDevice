/**
 * Side-view freecam screenshots of the new truck batch.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const OUT = "/opt/cursor/artifacts/garage-sides";
mkdirSync(OUT, { recursive: true });

const TRUCKS = [
  "fjord-razorback",
  "beep-sabertooth",
  "headbutt-tyrannosaur",
  "headbutt-thunder-bison",
  "headbutt-mammoth",
  "grr-grizzly",
  "coyota-tasmanian-devil",
  "voltra-ankylosaur",
  "bummer-war-hippo",
  "river-run-swamp-beast",
];

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  userDataDir: "/tmp/chrome-truck-shots",
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
  game.setSideFreecam?.(10, 2.2);
});

await new Promise((r) => setTimeout(r, 900));

for (const id of TRUCKS) {
  await page.evaluate(async (carId) => {
    const game = window.__driveGame;
    await game.switchCar(carId);
    game.reset?.();
    game.setSideFreecam?.(10, 2.2);
  }, id);
  await new Promise((r) => setTimeout(r, 1500));
  const file = `${OUT}/${id}.png`;
  await page.screenshot({ path: file });
  console.log("shot", id, file);
}

await browser.close();
console.log("done", TRUCKS.length);
