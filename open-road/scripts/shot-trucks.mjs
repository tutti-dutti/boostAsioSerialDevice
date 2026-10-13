/**
 * Side-view freecam screenshots of the new truck batch.
 * One Chrome launch; screenshots written with retries.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "/opt/cursor/artifacts/garage-sides";
mkdirSync(OUT, { recursive: true });

const TRUCKS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
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
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--single-process",
    "--window-size=1280,720",
  ],
  defaultViewport: { width: 1280, height: 720 },
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.goto("http://localhost:5173/?t=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__driveGame, { timeout: 25000 });

  await page.evaluate(async () => {
    const game = window.__driveGame;
    document.querySelector("#play")?.click();
    await game.start();
    game.setSideFreecam?.(10, 2.2);
  });
  await new Promise((r) => setTimeout(r, 1000));

  for (const id of TRUCKS) {
    await page.evaluate(async (carId) => {
      const game = window.__driveGame;
      await game.switchCar(carId);
      game.reset?.();
      game.setSideFreecam?.(10, 2.2);
    }, id);
    await new Promise((r) => setTimeout(r, 1600));
    const buf = await page.screenshot({ type: "png", encoding: "binary" });
    const file = `${OUT}/${id}.png`;
    writeFileSync(file, buf);
    console.log("shot", id, file);
  }
} finally {
  try {
    await browser.close();
  } catch {
    /* ignore close races */
  }
}
console.log("done", TRUCKS.length);
