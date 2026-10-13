# Open Road

A small open-world driving game. One sports car, a big map, and an engine sound that revs as you drive.

The car model is `sedan-sports` from [Kenney's Car Kit](https://kenney.nl/assets/car-kit) (CC0). Attribution is not required.

This project is separate from Cookie Guard.

## Play

Online: https://open-road-632221334464.us-central1.run.app

```bash
cd open-road
npm install
npm run dev
```

Open the link Vite prints (usually http://localhost:5173). Click **Drive**, then turn your sound on.

## Controls

| Key | What it does |
| --- | --- |
| W / Up | Gas |
| S / Down | Brake, then reverse |
| A D or Left / Right | Steer |
| Space | Handbrake slide |
| C | Chase, bumper, or hood camera |
| H | Horn |
| G | Garage. Every car is free, and you stay where you are |
| R | Back to the start |

The on-screen buttons do the same thing. The red **Garage** button sits next to Horn. A controller works too: right trigger gas, left trigger brake, A to slide, Y for the camera, B for the horn.

Stay on the gray road to go fast. Grass, dirt, sand, and the lake are slower. The glowing minimap shows the roads, the lake, and your car.

The engine, wind, tire squeal, horn, and bump sounds are generated in the browser. A rock song loops in the background after you click Drive, and it pauses when you open the menu. The car is an original design called Comet, not a real brand.
