import {
  BRIDGE_SAMPLES,
  heightAt,
  terrainHeightAt,
  samplePathXZ,
  HIGHWAY,
  PATHS,
} from "../src/drive/mapData.ts";

const hwy = samplePathXZ(HIGHWAY, 220);
let maxG = 0;
let steep = 0;
for (let i = 1; i < hwy.length; i++) {
  const h0 = heightAt(hwy[i - 1].x, hwy[i - 1].z);
  const h1 = heightAt(hwy[i].x, hwy[i].z);
  const ds = Math.hypot(hwy[i].x - hwy[i - 1].x, hwy[i].z - hwy[i - 1].z);
  const g = Math.abs(h1 - h0) / Math.max(0.1, ds);
  if (g > maxG) maxG = g;
  if (g > 0.06) steep++;
}
console.log("hwy max grade", maxG.toFixed(3), "steep", steep, "/", hwy.length);
for (const path of PATHS) {
  const pts = samplePathXZ(path, 80);
  let mg = 0;
  for (let i = 1; i < pts.length; i++) {
    const g =
      Math.abs(heightAt(pts[i].x, pts[i].z) - heightAt(pts[i - 1].x, pts[i - 1].z)) /
      Math.max(0.1, Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    if (g > mg) mg = g;
  }
  console.log("path max grade", mg.toFixed(3), "pts", pts.length);
}
console.log("bridge", BRIDGE_SAMPLES.length);
if (BRIDGE_SAMPLES.length) {
  let mg = 0;
  for (let i = 1; i < BRIDGE_SAMPLES.length; i++) {
    const ds = Math.hypot(
      BRIDGE_SAMPLES[i].x - BRIDGE_SAMPLES[i - 1].x,
      BRIDGE_SAMPLES[i].z - BRIDGE_SAMPLES[i - 1].z,
    );
    const g = Math.abs(BRIDGE_SAMPLES[i].h - BRIDGE_SAMPLES[i - 1].h) / Math.max(0.1, ds);
    if (g > mg) mg = g;
  }
  console.log("bridge max grade", mg.toFixed(3));
  const mid = BRIDGE_SAMPLES.reduce((a, b) => (b.lift > a.lift ? b : a));
  console.log(
    "under bridge terrain",
    terrainHeightAt(mid.x, mid.z).toFixed(1),
    "deck",
    mid.h.toFixed(1),
  );
}
