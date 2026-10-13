/**
 * In-game smoke: Razorback on dirt spur + rocks, report suspension / surface / speed.
 */
import puppeteer from "puppeteer-core";

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
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("http://127.0.0.1:5173/?t=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__driveGame, { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const game = window.__driveGame;
    document.querySelector("#play")?.click();
    await game.start();
    await game.switchCar("fjord-razorback");
    game.reset?.();

    // Dirt spur starts near [-110, 70]
    const car = game.car ?? game["car"];
    // Access via private fields is not possible; drive using held keys and teleport via reset position.
    // Use internal place by evaluating through a probe on frame info + key holds.
    const samples = [];
    let peakSusp = 0;
    let minSusp = 9;
    let dirtSamples = 0;
    let peakMphOnDirt = 0;
    let listedTop = 112;

    // Teleport onto dirt trail by writing car pose through a temporary hook
    const g = game;
    const internal = g;
    // DriveGame keeps car private — nudge by resetting then holding forward from spawn,
    // and also try to set position if exposed.
    if (internal.car) {
      internal.car.x = -170;
      internal.car.z = 120;
      internal.car.yaw = Math.atan2(-70, 50); // roughly along spur toward NW
      internal.car.speed = 25;
      internal.car.y = 20;
    }

    game.hold?.("throttle", true);
    const start = performance.now();
    while (performance.now() - start < 8000) {
      await new Promise((r) => requestAnimationFrame(r));
      const info = await new Promise((resolve) => {
        const prev = g.onFrame;
        // Frame callback already wired — read HUD from DOM
        resolve({
          mph: Number(document.querySelector("#speed")?.textContent ?? 0),
          surface: document.querySelector("#surface")?.textContent ?? "",
          toast: document.querySelector("#toast")?.textContent ?? "",
        });
      });
      const mph = info.mph;
      const surface = (document.body.innerText.match(/Dirt|Grass|Dry|Mud|Sand|Wet/i) || [])[0] || "";
      if (/dirt/i.test(surface) || mph > 0) {
        /* continue */
      }
      samples.push({ mph, surface });
      if (/dirt/i.test(document.querySelector(".hud")?.innerText ?? "")) {
        dirtSamples += 1;
        peakMphOnDirt = Math.max(peakMphOnDirt, mph);
      }
      // Probe suspension if accessible
      if (internal.car?.susp) {
        for (const s of internal.car.susp) {
          peakSusp = Math.max(peakSusp, s);
          minSusp = Math.min(minSusp, s);
        }
      }
    }
    game.hold?.("throttle", false);

    // Launch a jump-like drop
    if (internal.car) {
      internal.car.y += 4;
      internal.car.vy = -2;
      internal.car.airTime = 0.1;
    }
    await new Promise((r) => setTimeout(r, 1500));
    if (internal.car?.susp) {
      for (const s of internal.car.susp) peakSusp = Math.max(peakSusp, s);
    }

    return {
      carName: document.querySelector(".car-name, #car-name")?.textContent ?? "",
      peakSusp,
      minSusp,
      dirtSamples,
      peakMphOnDirt,
      hud: document.querySelector(".hud")?.innerText?.slice(0, 400) ?? "",
      samples: samples.slice(-5),
      hasLongTravel: !!internal.tune?.longTravel,
      ride: internal.visual?.ride,
    };
  });

  console.log(JSON.stringify({ result, errors }, null, 2));
  await page.screenshot({ path: "/opt/cursor/artifacts/razorback-dirt.png", type: "png" });
  console.log("shot /opt/cursor/artifacts/razorback-dirt.png");
} finally {
  await browser.close();
}
