/** Side/overhead shots of town streets: crosswalks, lamps, curbs. */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OUT = "/opt/cursor/artifacts/street-fixes";
mkdirSync(OUT, { recursive: true });
mkdirSync("/tmp/street-fixes", { recursive: true });

function savePng(name, b64) {
  const tmp = `/tmp/street-fixes/${name}.png`;
  const dest = `${OUT}/${name}.png`;
  writeFileSync(tmp, Buffer.from(b64, "base64"));
  try {
    copyFileSync(tmp, dest);
  } catch {
    execFileSync("cp", [tmp, dest]);
  }
}

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
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:5173/?t=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__driveGame, { timeout: 30000 });

  const shots = [
    { name: "crosswalk-center", x: 0, z: 14, yaw: 0, dist: 12, height: 6 },
    { name: "lamps-east", x: 80, z: 0, yaw: Math.PI / 2, dist: 16, height: 5 },
    { name: "curbs-east", x: 60, z: 0, yaw: 0, dist: 14, height: 4 },
  ];

  await page.evaluate(async () => {
    const game = window.__driveGame;
    document.querySelector("#play")?.click();
    await game.start();
  });
  await new Promise((r) => setTimeout(r, 800));

  for (const s of shots) {
    await page.evaluate((cfg) => {
      const game = window.__driveGame;
      const car = game.car;
      if (car) {
        car.x = cfg.x;
        car.z = cfg.z;
        car.yaw = cfg.yaw;
        car.speed = 0;
        car.y = 30;
      }
      game.setSideFreecam?.(cfg.dist, cfg.height);
      // Aim freecam more usefully
      if (game.camMode === "free" || true) {
        game.freeYaw = cfg.yaw + Math.PI * 0.65;
        game.freeDist = cfg.dist;
        game.freeHeight = cfg.height;
        game.snap = true;
      }
    }, s);
    await new Promise((r) => setTimeout(r, 900));
    const b64 = await page.screenshot({ type: "png", encoding: "base64" });
    savePng(s.name, b64);
    console.log("shot", s.name);
  }

  // Probe geometry: lamp poles should have zero world pitch/roll; crosswalk bars road-width.
  const probe = await page.evaluate(() => {
    const game = window.__driveGame;
    const root = game.world?.object;
    let tiltedPoles = 0;
    let poles = 0;
    let crossBars = 0;
    let wideBars = 0;
    root?.traverse((obj) => {
      if (!obj.isMesh) return;
      const geo = obj.geometry;
      if (!geo) return;
      // Streetlight poles are tall thin cylinders in a yaw-only rig
      const parent = obj.parent;
      if (parent && parent.type === "Group" && geo.type === "CylinderGeometry") {
        const params = geo.parameters;
        if (params && params.height > 4) {
          poles += 1;
          parent.updateMatrixWorld(true);
          const e = new (window.THREE?.Euler || Object)();
          // Read world quaternion → euler
          const wq = parent.getWorldQuaternion(new (game.camera.constructor === Object ? Object : parent.quaternion.constructor)());
          // Simpler: parent.rotation should be (0, yaw, 0)
          if (Math.abs(parent.rotation.x) > 0.01 || Math.abs(parent.rotation.z) > 0.01) tiltedPoles += 1;
        }
      }
      if (geo.type === "BoxGeometry" && geo.parameters) {
        const { width, height, depth } = geo.parameters;
        if (height < 0.05 && width > 10 && width < 14 && depth < 0.6) {
          crossBars += 1;
          if (width > 13.2) wideBars += 1; // would stick past 14m road
        }
      }
    });
    return { poles, tiltedPoles, crossBars, wideBars };
  });

  console.log(JSON.stringify({ probe, errors }, null, 2));
} finally {
  try {
    await browser.close();
  } catch {
    /* ignore */
  }
}
