# QB simulator roadmap

Milestone 1 is the pass itself: the ball goes where you aim, on a mouse or a thumb, and the game tells you what happened. Later milestones build the playbook, the stadium, and the modes on top of that.

Numbers below are from this machine's software renderer (no GPU). They are a ceiling check, not a phone score. A real mid-range phone GPU is a different device. What they are good for is "did this change make the frame heavier?"

## What was weak

The pass did not go to the crosshair. Charging added a fixed upward nudge, then the throw shifted the target by a world-space `(5, -8, 0)`. Hold-to-throw was advertised as a mouse button and implemented as the space bar. Charge speed and foot speed were counted in frames, so 30fps and 144fps were different games.

A new ball waited until the previous one had died. The score on screen never changed. A catch was a 0.5-yard sphere on the body center, logged to the console on every frame the ball was in the air. The trajectory was drawn after the throw and did not match the flight.

Portrait phones were a full-screen "rotate your device" gate. Aiming was the right half of the screen only, and the thumb holding Throw could not keep aiming.

The two player models are the load and the frame. The quarterback is 3.5 MB and about 357k vertices. The receiver is 6.9 MB and about 379k vertices, with clearcoat materials. The field was a couple hundred separate hash-mark meshes. A shadow map of those players, plus multisample antialiasing, dropped this machine from about 9fps to about 3fps at 1280×720.

The stadium file the field asked for (`acrisure_stadium_pittsburgh_pa (1).glb`) is not in the repo. It is no longer requested until someone presses F.

## Milestone 1 — the pass (this branch)

- The crosshair is a point in the world. Enough arm puts the ball through that point on the lower arc. Not enough arm is a flat pass that dies short, drawn in red before you let go.
- Left mouse or Space charges and throws. Movement and the charge use time, not frames.
- A new ball is back in the hand a quarter of a second after release.
- Catches score points (tightness, depth, and a touchdown past the goal line). A banner, a flash, a small camera kick, and a synthesized sound mark the result.
- Touch works in landscape and portrait. Drag anywhere to aim. Hold Throw and drag to keep aiming, then release. Hike, Routes, Ball, and Reset are on screen.
- One Escape press pauses, including the press the browser uses to leave pointer lock.
- Pixel ratio is capped (1.5 on touch, 2 on desktop). No shadow map and no multisampling until the meshes are lighter. Characters use standard materials instead of clearcoat. The first-person body is not drawn. Hash marks and yard lines are instanced.
- Throw math, scoring, and movement have `node --test` coverage.
- `VITE_BASE` overrides the production base path. The default stays `/demos/qb-simulator/`.

### Measured here

Software GL, headed Chrome, after a short warmup.

| View | Before | After |
| --- | --- | --- |
| 1280×720, DPR 1 | ~8 fps, p95 frame ~137ms | ~9 fps, p95 frame ~134ms |
| 844×390, DPR 2 | ~11 fps, p95 frame ~112ms | ~10 fps, p95 frame ~119ms |
| 390×844, DPR 2 | ~11 fps, p95 frame ~108ms | ~9 fps, p95 frame ~139ms |

The after scene draws about 483k triangles. The frame is the receiver mesh. Turning multisampling and a soft shadow map back on dropped the same desktop view to ~3 fps, which is why they are off.

JS bundle: 703 KB (185 KB gzip) before, about 710 KB (189 KB gzip) after. CSS 7.7 KB to about 11 KB. The models are unchanged at 3.5 MB + 6.9 MB and still dominate the load.

## Milestone 2 — line, plays, and a drive

Shipped on this branch: code-built offense (four receivers, five linemen, a tight end, and a back), preset plays plus a hand-drawn play designer saved in `localStorage`, four downs, and stands drawn in code. The Sketchfab player meshes are no longer in the tree.

## Milestone 3 — the field, up close

- Yard numbers that read from the pocket, and goal posts with a crossbar.
- A little more life in the stands without another heavy mesh.
- Jerseys you can tell apart at a glance, still in one draw.

## Milestone 4 — juice

- A ribbon on the ball, a catch burst, a short hit-stop, crowd swell from the same synthesizer.
- The camera sells the touchdown without covering the field.

## Milestone 5 — modes and settings

- Practice, an accuracy challenge, and the drive from milestone 2 as a picked mode.
- Best scores in `localStorage` only. No account, no network.
- Sensitivity, invert look, volume. Reduced motion already skips the camera kick.
- The power meter stays readable without color alone. The pause screen keeps every control.
