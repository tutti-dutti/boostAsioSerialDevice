# OPEN ROAD: EVERYTHING FILE

This one file has everything for the game: the fix list, the car list, and the build plan.

## How to use this file (for the AI)
1. Do PART 1 (fixes) first, all of them, in order. Test after each one.
2. Use PART 2 (garage) for every car name. Never show real car brands in the game.
3. Only do PART 3 (build plan) steps when I ask, one step at a time.
4. If I attached lambchop-engine.mp3, use it for Fix 11. If not, skip Fix 11.

---

# PART 1: FIXES

Do these in order, one at a time. Test the game in the browser after each one. Do not start the build-plan steps until all of these are done. When everything is finished, give me a short list of what works and what still doesn't.

## Fix 1: Make sure I'm playing the newest version
When I open the game I still see the old flat map with pointy mountains, but your tests show the new hilly map with the town. Make sure my local game runs the latest code, restart the game server, and tell me the exact link to open.

## Fix 2: Car models won't load
When I pick a car in the Garage, it sometimes says "That car did not load" and shows a brown backup buggy. Check the browser console, find why the models fail to load (wrong path, missing file, or bad format), and fix it. Test every car in the Garage and make sure each one loads.

## Fix 3: Fix the new Lambchop look
The new Lambchop wheels show up as big white spheres floating outside the body, with thin black sticks below them.
- Each wheel should be a round black tire with a silver or black rim, sitting inside the wheel arches, touching the road, and rotating.
- Make the body lower and wider like a real supercar, with sharp angled edges, a wedge-shaped nose, and big side air intakes.
- Paint it bright orange or green.
- Take a screenshot of the car from the side and from behind, and check it looks right before moving on.
- Once all three Lambchops look good, use the same method for the rest of the Garage, matching each car's Shape reference in garage.md.

## Fix 4: Strong, realistic brakes
The brakes are way too weak. Sports cars and supercars should stop from 60 mph to 0 in about 3 seconds (around 100 feet). Trucks take about 4 seconds. S and the down arrow brake hard. Space is the handbrake for sliding. Test by braking from 60 mph.

## Fix 5: Less sliding
The car slides way too much. Give the tires more grip so the car stays planted in normal turns. It should only slide when I turn really hard or use the handbrake. Wet roads, dirt, grass, and ice have less grip than dry road.

## Fix 6: Realistic suspension
Give each wheel its own spring and damper. The body leans a little in corners, dips forward when braking, and squats back when accelerating, then settles smoothly with no bouncing or wobbling. Sports cars are stiff and low. Trucks are softer, taller, and absorb bumps better off-road.

## Fix 7: Turning
The turning circle is still too wide.
- At low speed, the car should make a U-turn in about 36 to 40 feet, like a real car on a two-lane road.
- At 25 mph, it must easily make a 90-degree turn onto a side road.
- Increase the maximum steering angle and make sure the front tires have enough grip to actually turn the car.
- Add a "Handling: Sim / Arcade" toggle in the Menu. Make Arcade the default.
  - Sim: realistic. Steering reduces at highway speed, and the car slides if I turn too hard.
  - Arcade: the car can make a sharp 90-degree turn onto a side road at 75 mph without sliding out, like a racing game. Lots of grip and fast steering, but stable so it doesn't spin.
- Test with a U-turn, an intersection turn at 25 mph, and an Arcade turn at 75 mph.

## Fix 8: Grass speed
The car is way too slow on grass. Cars should reach about 70 to 80 percent of road top speed on grass. Trucks should be almost full speed. Grass has a bit less grip than road.

## Fix 9: Real engine sounds
Every car sounds the same, like a fire truck horn. Give each vehicle its own engine sound that matches its Shape reference in garage.md:
- V8 muscle cars and trucks: deep, rumbly growl
- V10 and V12 supercars: high, screaming wail
- Turbo cars: whoosh when speeding up and a blow-off "pssh" when I let off the gas
- Electric cars: quiet futuristic whine that rises with speed
- Diesel trucks: low, clattery rumble

Pitch rises with RPM and drops on each gear shift. Idle sounds smooth and low. Use free CC0 engine recordings if possible. If you build sounds with the Web Audio API, layer several tones with noise so they don't sound like a horn or a beep. The horn only plays when I press H.

## Fix 10: Reverse on grass
On grass, reverse is really fast but forward is slow. Make grass slow forward and reverse the same way. Max reverse speed is about 15 to 20 mph on any surface, with one reverse gear.

## Fix 11: Lambchop engine sound
Use sounds/lambchop-engine.mp3 as the engine sound for the three Lambchop cars. Loop the steady part so it plays smoothly while driving, raise the pitch as RPM goes up, and play the full rev when I floor it from a stop. Credit "Chrysalyn on Pixabay" in the Menu.

---

# PART 2: GARAGE

## Instructions for the AI building the game

- Show ONLY the "Game brand" and "Game name" in the game (example: "Lambchop Chupacabra").
- The "Shape reference" column is only a guide for body style, size, and speed. Never show real brand names, model names, or logos anywhere in the game.
- Make each vehicle an original lookalike, not an exact copy.
- Type "Fastest" = highest top speed and acceleration for that brand. "Famous" = balanced. "Truck" = slower, heavier, better off-road.
- Do not add all vehicles at once. Add about five at a time, and make sure the game still runs after each batch.

## Vehicles

| Game brand | Game name | Type | Shape reference (do not show in game) |
|---|---|---|---|
| Lambchop | Chupacabra | Famous | Lamborghini Aventador |
| Lambchop | Minotaur | Fastest | Lamborghini Revuelto |
| Lambchop | Bonehorn | Newest | Lamborghini Temerario |
| Shovel-A | Thresher | Famous | Chevrolet Corvette Stingray |
| Shovel-A | Megalodon | Fastest | Chevrolet Corvette ZR1 |
| Shovel-A | Mastodon | Truck | Chevrolet Silverado ZR2 |
| Baguetti | Hellhound | Famous | Bugatti Veyron |
| Baguetti | Cerberus | Fastest | Bugatti Chiron Super Sport |
| Ferocity | Jackal | Famous | Ferrari F40 |
| Ferocity | Manticore | Fastest | Ferrari LaFerrari |
| Porch | Deathstalker | Famous | Porsche 911 Turbo S |
| Porch | Hellbender | Fastest | Porsche 918 Spyder |
| McRoar | Pterodactyl | Famous | McLaren P1 |
| McRoar | Great White | Fastest | McLaren Speedtail |
| King Egg | Leviathan | Famous | Koenigsegg Agera RS |
| King Egg | Kraken | Fastest | Koenigsegg Jesko Absolut |
| Pajama | Basilisk | Famous | Pagani Zonda |
| Pajama | Gorgon | Fastest | Pagani Huayra |
| Astro Marlin | Vampire Bat | Famous | Aston Martin DB5 |
| Astro Marlin | Sky Serpent | Fastest | Aston Martin Valkyrie |
| Lettuce | Poison Dart | Famous | Lotus Elise |
| Lettuce | Fer-de-Lance | Fastest | Lotus Evija |
| Mozzaretti | Moray | Famous | Maserati GranTurismo |
| Mozzaretti | Fangtooth | Fastest | Maserati MC20 |
| Alpha Romeow | Emperor Scorpion | Famous | Alfa Romeo Giulia Quadrifoglio |
| Alpha Romeow | Devil Squid | Fastest | Alfa Romeo 33 Stradale |
| Rimzap | Thunder Lizard | Famous | Rimac Nevera |
| Rimzap | Hydra | Fastest | Rimac Nevera R |
| Hennypenny | Death Adder | Famous | Hennessey Venom GT |
| Hennypenny | Taipan | Fastest | Hennessey Venom F5 |
| Hiss | Copperhead | Famous | SSC Ultimate Aero |
| Hiss | Gila Monster | Fastest | SSC Tuatara |
| Fjord | Nightmare | Famous | Ford Mustang |
| Fjord | Griffin | Fastest | Ford GT |
| Fjord | Razorback | Truck | Ford F-150 Raptor |
| Duck | Wolverine | Famous | Dodge Challenger Hellcat |
| Duck | Black Mamba | Fastest | Dodge Viper |
| Cattleac | Cape Buffalo | Famous | Cadillac Escalade |
| Cattleac | Night Crow | Fastest | Cadillac CT5-V Blackwing |
| Voltra | Lionfish | Famous | Tesla Model 3 |
| Voltra | Thunder Eel | Fastest | Tesla Model S Plaid |
| Voltra | Ankylosaur | Truck | Tesla Cybertruck |
| Lucky | Box Jelly | Famous | Lucid Air |
| Lucky | Man o' War | Fastest | Lucid Air Sapphire |
| River Run | Swamp Beast | Famous (Truck) | Rivian R1T |
| River Run | Wendigo | Fastest (Truck) | Rivian R1S |
| Beep | Werewolf | Famous | Jeep Wrangler |
| Beep | Dire Wolf | Fastest | Jeep Grand Cherokee Trackhawk |
| Beep | Sabertooth | Truck | Jeep Gladiator |
| Headbutt | Thunder Bison | Famous (Truck) | Ram 1500 |
| Headbutt | Tyrannosaur | Fastest (Truck) | Ram 1500 TRX |
| Headbutt | Mammoth | Truck | Ram 2500 Power Wagon |
| GRR | Grizzly | Famous (Truck) | GMC Sierra |
| GRR | Ice Fang | Fastest (Truck) | GMC Syclone |
| GRR | Cave Bear | Truck | GMC Yukon Denali |
| Bummer | War Hippo | Famous (Truck) | Hummer H1 |
| Bummer | Tusker | Fastest (Truck) | Hummer EV pickup |
| Ninjan | Shadow Lizard | Famous | Nissan Skyline GT-R R34 |
| Ninjan | Kaiju | Fastest | Nissan GT-R Nismo |
| Ninjan | Komodo Dragon | Truck | Nissan Titan |
| Coyota | Man-Eater | Famous | Toyota Supra Mk4 |
| Coyota | Bone Tiger | Fastest | Toyota GR Supra |
| Coyota | Tasmanian Devil | Truck | Toyota Tacoma TRD Pro |
| Lynxus | Night Leopard | Famous | Lexus LC 500 |
| Lynxus | Screech Owl | Fastest | Lexus LFA |
| Hounda | Fire Ant | Famous | Honda Civic Si |
| Hounda | Yellowjacket | Fastest | Honda Civic Type R |
| Hounda | Honey Badger | Truck | Honda Ridgeline |
| Akita | Shrike | Famous | Acura Integra Type R |
| Akita | Harpy | Fastest | Acura NSX Type S |
| Moozda | Assassin Bug | Famous | Mazda MX-5 Miata |
| Moozda | Sawfish | Fastest | Mazda RX-7 |
| Subaroo | Killer Rabbit | Famous | Subaru WRX |
| Subaroo | Jackalope | Fastest | Subaru WRX STI S209 |
| Mitsufishi | Hyena | Famous | Mitsubishi Lancer Evolution |
| Mitsufishi | Warg | Fastest | Mitsubishi 3000GT VR-4 |
| Hyenadai | Terror Bird | Famous | Hyundai Veloster N |
| Hyenadai | Storm Crow | Fastest | Hyundai Ioniq 5 N |
| Kiwi | Bullet Ant | Famous | Kia Stinger GT |
| Kiwi | Vulture | Fastest | Kia EV6 GT |
| BARK | Piranha | Famous | BMW M3 |
| BARK | Bull Shark | Fastest | BMW M5 CS |
| Merciless | Gargoyle | Famous | Mercedes-AMG GT |
| Merciless | Dragon | Fastest | Mercedes-AMG One |
| Merciless | Silverback | Truck | Mercedes G-Wagon |
| Howdy | Frost Wolf | Famous | Audi RS6 Avant |
| Howdy | Lycan | Fast | Audi R8 V10 |
| Howdy | Microwave | Fastest | Audi Nuvolari (the R8 successor) |
| Wolfswagen | Scarab | Famous | Volkswagen Beetle |
| Wolfswagen | Locust | Fastest | Volkswagen Golf R |
| Batley | Shadow Lynx | Famous | Bentley Continental GT |
| Batley | Ice Stalker | Fastest | Bentley Continental Supersports |
| Roly-Poly | Grim Raven | Famous | Rolls-Royce Phantom |
| Roly-Poly | Mothman | Fastest | Rolls-Royce Wraith Black Badge |
| Pounce | Shadow Panther | Famous | Jaguar F-Type |
| Pounce | Night Prowler | Fastest | Jaguar XJ220 |
| Land Roamer | Moor Hound | Famous | Land Rover Defender |
| Land Roamer | Loch Ness | Fastest | Range Rover Sport SV |
| Land Roamer | Highland Beast | Truck | Range Rover |
| Teeny | Sewer Rat | Famous | Mini Cooper S |
| Teeny | Rat King | Fastest | Mini John Cooper Works GP |
| Viking | Krampus | Famous | Volvo XC90 |
| Viking | Frost Troll | Fastest | Volvo S60 Polestar |

---

# PART 3: BUILD PLAN

## Instructions for the AI building the game

- Do ONLY the step number I ask for. Do not start other steps.
- Do not break features that already work (driving, Garage, start screen).
- Keep the game running smoothly. If something is too heavy, use a cheaper trick instead.
- Test the game in the browser when the step is done.
- When finished, tell me in a few short lines what you added and how to try it.

---

## Step 1: Realistic map

- Make the world much bigger, with rolling hills instead of flat ground.
- Add trees, rocks, bushes, and a few buildings (gas station, houses, a small town).
- Add a sky with clouds and distance fog so far-away things fade in.
- Load the world in chunks around the car so it doesn't lag.

## Step 2: Realistic streets

- Rebuild the roads as smooth curved meshes that follow the hills, using splines, so there are no gaps, bumps, or floating pieces.
- Fix any flickering where the road overlaps the grass (z-fighting).
- Make sure the car never falls through the road or gets stuck on seams.
- Use an asphalt texture with yellow center lines, white edge lines, and dashed lane lines.
- Build proper intersections with stop lines and crosswalks.
- Add curbs and sidewalks in town, gravel shoulders outside of town, guardrails, and road signs.
- Place streetlights along town roads and the highway. Make the lamps glow with an emissive material and a light pool painted on the road. Only use real light sources for the few lamps closest to the car.

## Step 3: Giant highway for speeding

- Build a long, wide highway loop around the whole map, 4 lanes each way.
- Long straight sections and gentle curves so I can hit top speed.
- Add on-ramps and off-ramps that connect it to the other roads.
- Show the highway on the minimap.

## Step 4: Off-road course

- Build an off-road area with dirt trails, jumps, mud pits, big rocks, and steep hill climbs.
- Dirt is more slippery than pavement, and mud slows the car down.
- Add a start and finish gate with a lap timer.
- Show the course on the minimap.

## Step 5: Giant cave for trucks

- Build a huge cave inside the mountain with an entrance big enough for the largest trucks.
- Inside: rocky trails, steep ramps, boulders to crawl over, shallow water crossings, and glowing crystals or lanterns so I can see.
- Turn headlights on automatically inside the cave.
- Show the cave entrance on the minimap.

## Step 6: Cops on/off button

- Add a "Cops: ON/OFF" button next to the Horn button. Cops start OFF.
- When cops are ON, police cars patrol the roads. If I speed past one, it turns on its lights and siren and chases me.
- If a cop stops me for 3 seconds, show "BUSTED" and reset my car. If I get far enough away, show "ESCAPED."
- When I turn cops OFF, all police cars disappear right away.

## Step 7: Realistic sounds for each vehicle

- Give every vehicle its own engine sound based on its engine type:
  - V8 muscle cars and trucks: deep, rumbly growl
  - V10 and V12 supercars: high, screaming wail
  - Turbo cars: whoosh when speeding up and a blow-off sound when I let off the gas
  - Electric cars: quiet futuristic whine that rises with speed
  - Big diesel trucks: low, clattery rumble
- Pitch rises with RPM and drops on each gear shift.
- Add tire squeal when sliding, wind noise at high speed, and gravel crunch off-road.
- Make sounds echo inside the cave.
- Use free CC0 engine recordings where possible. If none fit, build the sound with the Web Audio API.
- Add a volume slider in the Menu.

## Step 8: Realistic car details

- Add a driver's seat camera with a working speedometer, tachometer, fuel gauge, and mirrors.
- Add headlights, high beams, brake lights, reverse lights, and turn signals with a blinker sound.
- Add fuel that drains as I drive, and gas stations where I can refill.
- Add crash damage: dents, cracked glass, smoke. Heavy damage hurts steering and top speed.
- Add a repair shop that fixes the car.

## Step 9: Realistic world

- Add a full day and night cycle with sunrise and sunset, plus a button to set the time. At night, streetlights and headlights turn on.
- Add changing weather: clear, rain, fog, snow. Wet roads look shiny and have less grip.
- Add traffic cars that follow the rules: stop at red lights, signal turns, obey speed limits, and keep a safe gap.
- Add working traffic lights, stop signs, and speed limit signs.
- Add a race track with curbs, a pit lane, and a lap timer with best lap saved.
- Limit the number of traffic cars and only simulate ones near me.

## Step 10: Realistic tuning

- Add a tuning garage with upgrades for engine, brakes, tires, suspension, and weight reduction. Everything is free.
- Each upgrade must actually change how the car drives.
- Add adjustable settings: tire pressure, gear ratios, ride height, and brake balance.
- Add a stats screen showing horsepower, weight, 0 to 60 time, and top speed.
- Add a "reset to stock" button.

## Step 11: More vehicles

- Add the next 10 vehicles from garage.md to the Garage, following the rules at the top of that file.
- Repeat this step whenever I ask for more.
