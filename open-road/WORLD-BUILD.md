# Open Road: World Build

Do these jobs in order, one at a time. Test after each one. Keep the game running smoothly the whole time: use instancing for trees, rocks, and repeated buildings, and lower detail for faraway objects. No sign, tree, building, or pillar may ever sit on a road or trail. When done, tell me what works and what doesn't.

## JOB 1: Giant forests

- Add 2 or 3 huge, dense forests in different corners of the map, away from the city.
- Mix tall pines, leafy trees, bushes, fallen logs, and boulders.
- Trees and big boulders are solid. Small bushes bend when driven over, then spring back.

## JOB 2: Off-road trails and mud

- Winding dirt trails cut through each forest and connect the forests to each other and to the mud park.
- Trails have ruts, bumps, roots, small rocks, tight turns, steep up and down hills, and narrow spots between trees. Mark them with wooden posts and trail signs (off to the side).
- Trail levels:
  - Easy (green signs): any car can do it.
  - Medium (blue signs): SUVs and trucks.
  - Hard (black signs): big rocks and steep climbs that only lifted trucks (Razorback, Mastodon, Sabertooth) can finish.
- Mud puddles and deep mud sections along the trails. Mud is brown and wet-looking, slippery, slows cars down, makes tires spin and fling mud, and leaves tire tracks. Deep mud nearly stops supercars, but trucks push through slowly.

## JOB 3: Off-road mud park

- A big mud park in an open area, connected to the main road by a dirt road, with an "OFF-ROAD PARK" sign at the entrance.
- Big mud pits, dirt hill climbs (some only trucks can make), 3 or 4 dirt jumps of different sizes, a rock crawling section, and a shallow creek crossing that splashes and slows you down.
- A start and finish gate with a lap timer and best lap saved.

## JOB 4: Speed test track

- A giant, perfectly flat, straight track about 8 km (5 miles) long, 4 lanes wide, with smooth asphalt, connected to the highway by an on-ramp, with a "SPEED TRACK" sign at the entrance.
- Distance markers every 1 km.
- On the track, show current speed, top speed this run, and best ever top speed for the car I'm driving.
- A 0 to 60 timer that starts when I launch from a stop on the start line.
- Banked turnaround loops at both ends.
- A big launch ramp off to the side near the end (not on the main straight), with a soft dirt landing area.

## JOB 5: City inside the highway loop

- Fill the empty space inside the main highway circle with a city: skyscrapers downtown in the middle, shorter office and apartment buildings around them, and houses near the edges.
- Buildings line the streets with sidewalks and never block a road.
- Lit-up windows, different heights and colors, and a few landmarks (a glass tower, a stadium, a parking garage).
- Small parks with trees between some blocks.

## JOB 6: Skyway (elevated highway around the whole map)

- A massive elevated highway circling the entire map, outside the existing highway loop.
- About 30 to 40 meters up on tall concrete pillars, above the tallest trees, so I can see the whole map below.
- 4 lanes each way, lane lines, a center barrier, and tall side barriers so cars can't fall off.
- Smooth, gentle curves and long straights for high speed.
- Pillars every 30 to 40 meters, standing on the ground, never on a road or trail.
- At least 4 long, smooth on-ramps and off-ramps to the regular highway, with no steps or gaps.
- Streetlights along the barriers.

## JOB 7: Restaurants

Add 3 restaurants to the city, on a busy street in town. Each one gets its own building, a big lit-up sign on the roof, outdoor tables, and a small parking lot:

1. **Pizza shop**: red and white building, a giant pizza slice sign, and a delivery car parked out front.
2. **Phở shop**: a Vietnamese noodle shop with a warm yellow and red sign that says "PHỞ" with a steaming bowl picture, and paper lanterns hanging out front.
3. **Bánh mì shop**: a Vietnamese sandwich shop with a green and yellow sign that says "BÁNH MÌ" with a baguette sandwich picture.

When I park in a restaurant's lot, show a popup like "🍜 Welcome to the Phở Shop!"

## JOB 8: Car wash and dirty cars

- Cars get dirty when driving through mud, dirt, and puddles: mud splatters build up on the body and wheels, a little at a time.
- Add a car wash in town: a building with spinning brushes, water spray, and bubbles. Drive in slowly, and the car comes out clean and shiny with a "Sparkling clean! ✨" popup.

## JOB 9: Traffic cars

- Computer-controlled cars drive around the city streets and highways in their own lanes.
- They keep a safe gap, slow down behind other cars, stop at red lights, and use turn signals.
- They brake or swerve if I get in their way, and react to crashes.
- Only simulate traffic near me, and limit the number of traffic cars so the game stays smooth.

## JOB 10: Day and night

- Full day and night cycle with sunrise, daytime, sunset, and night (about 20 minutes for a full day).
- At night: the sky turns dark with stars, streetlights and skyscraper windows light up, and all cars turn on headlights and taillights.
- A Time button in the Menu to jump to morning, noon, sunset, or night, or pause the clock.
- Add working traffic lights at city intersections that change green, yellow, red.

## JOB 11: Cops

- Add a "Cops: ON/OFF" button next to the Horn button. Cops start OFF.
- When cops are ON, police cars patrol the city and highways.
- Add speed limit signs: 30 mph in the city, 65 mph on the highway and skyway, 45 mph on other roads. The current speed limit shows next to my speedometer.
- I get chased if a police car sees me:
  - Speeding more than 10 mph over the limit
  - Running a red light
  - Crashing into another car or a police car
  - Driving on the wrong side of the road
- When chased: the police car turns on flashing red and blue lights and a siren and follows me. A "WANTED" meter shows on screen. More cops join if I keep breaking rules.
- If a cop boxes me in and I'm stopped for 3 seconds, show "BUSTED" and reset my car nearby.
- If I get far enough away and out of sight for 15 seconds, show "ESCAPED."
- When I turn cops OFF, all police cars disappear right away.

## Minimap

Put all 3 restaurants and the car wash on the minimap with icons. Show police cars as flashing red and blue dots when they're chasing me.

Show the forests, trails, mud, mud park, speed track, city blocks, and skyway on the minimap. Use a different color for the skyway.

## Tests

- Drive the Fjord Razorback on every trail level and through the mud park.
- Try a supercar on an easy trail.
- Drive the King Egg Kraken to top speed on the speed track, and time the River Run Swamp Beast from 0 to 60.
- Drive the whole skyway loop at high speed and check every ramp.
