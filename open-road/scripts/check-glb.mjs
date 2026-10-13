import { readFileSync } from "node:fs";
import path from "node:path";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FileLoader } from "three";

const file = process.argv[2] || "public/models/king-egg-kraken.glb";
const abs = path.resolve(file);

const loader = new GLTFLoader();
const fileLoader = new FileLoader(loader.manager);
fileLoader.setResponseType("arraybuffer");
loader.manager.addHandler(/\.glb$/i, {
  load(url, onLoad, onProgress, onError) {
    try {
      const buf = readFileSync(url.startsWith("file:") ? new URL(url) : url);
      onLoad(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    } catch (e) {
      onError?.(e);
    }
  },
});

const gltf = await loader.loadAsync(abs);
const scene = gltf.scene;
const wheels = [];
const names = [];
scene.traverse((o) => {
  names.push(o.name || "(unnamed)");
  if (o.name.startsWith("wheel-")) wheels.push(o.name);
});
console.log("ok", path.basename(abs), "top=", scene.children.map((c) => c.name));
console.log("wheels", wheels.length, wheels);
let nan = 0;
scene.traverse((o) => {
  if (!o.isMesh || !o.geometry?.attributes?.position) return;
  const arr = o.geometry.attributes.position.array;
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) nan++;
});
console.log("nanVerts", nan);
