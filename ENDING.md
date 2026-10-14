# The ending (V20)

The last milestone of AutumNation and the scenes that follow it. This file is the plan for the whole thing and for each
scene on its own, so one scene can be worked on later without reading the rest.

- **Code:** the trigger, the letter, the ride out and the return live in `public/game.js` (search `V20`). The scenes
  themselves live in `public/ending.js`, one section per scene (`makeFactory`, `makeBank`, `makeStorage`).
- **Status:** the flow is done end to end. The scenes are a first pass: everything listed below happens, but the art and
  the number of robots and machines are meant to grow (see "Later" under each scene).

## Quick reference

| # | Beat | Where | Rough length |
|---|------|-------|--------------|
| 1 | Sell 2,000 iron ingots | first yard, `works` goal group | (play) |
| 2 | The final letter arrives (golden) | first yard | next pickup |
| 3 | Tinker rides off, the camera follows the truck, cut | first yard | ~10 s |
| 4 | **Scene 1 — Robot factory** | ending.js | ~45 s |
| 5 | **Scene 2 — Bank** | ending.js | ~55 s |
| 6 | **Scene 3 — Storage** | ending.js | ~14 s |
| 7 | Back in the yard, Tinker hops off, "Great work!", Continue | first yard | — |

Scene names are never shown in the game; they're only for us.

## Testing

- **Test panel** (tap the cash 3 times) → *Jump to*:
  - "First yard: 2,000 ingots sold, the final letter comes" — a new game played forward to that point (wipes saves
    like the other jumps); the driver brings the golden letter with the next pickup (a few seconds).
  - "First yard: final letter read, Ride along ready" — the same, with the letter already read (Ride along waits in
    Tinker's Off pile; the panel's Next step sends Tinker).
  - "Ending: the whole ride (preview)", "Ending: robot factory (preview)", "Ending: bank (preview)",
    "Ending: storage (preview)" — play right away, **nothing is wiped or changed**; the yard comes back as it was.
- **URL:** `?ending=factory` (or `bank`, `storage`, `all`) plays a preview on load; `?fresh&ending=bank` for a clean yard.
- **Console:** `__leafYard.ending('bank')`, `__leafYard.endingState()` (where it's got to),
  `__leafYard.endingFF(10)` (fast-forward 10 s without drawing, for headless tests).
- **Skip ›** (bottom right) skips the rest of the ending.

## 1–3. The trigger, the final letter, the ride out (game.js)

- `INGOT_GOAL` is 2,000 (was 1,000). The goal pill "Sell 2,000 iron ingots" follows Repair the smelting plant in the
  `works` group. Reaching it (milestone `ingots`) posts the `final` letter and toasts "The old works are humming … The
  driver seems to have something for you…". A V18 save that had already reached 1,000 gets the goal back.
- `LETTERS.final`: title **Final letter**, text **"I think you want to see this"**, signed Trucker, `gold: true`. It's
  delivered like every other letter (the driver steps out, walks over, and puts it down on the curb in front of the
  workshop). Gold means: the
  driver carries a gold envelope (`drawGoldEnvelope`, with a shine sweeping across it), it flies down with a sparkle and
  a chime, the pop says "The final letter!", it lies in a soft golden glow with twinkles (`goldTwinkles`), and the
  letter card is gold paper with a moving shine (`.letter.gold` in style.css).
- Reading it (`openEndingTrip`): a trip `{ to: 'ending', who: 0 }` opens and **Ride along** ("Ride along with the
  driver") appears in Tinker's **Off** pile, like every trip task: the player drags it into Do when they're ready (the
  toast and the letter card say so). Then Tinker heads for the curb. Once it waits there the truck
  comes within a few seconds (`updBoarding`). It hops in, the truck pulls away and the truck camera (the same as every
  trip) zooms in and follows it for 4.2 s, then `beginEnding()` cuts to black and the ending starts.
- `S.flags.ending`: 1 letter read, 2 playing, 3 seen. `S.flags.endBot`: which robot rode along. `S.flags.endPop`: the
  popup still to show. A reload while it plays starts the ending again from scene 1; a reload before Continue shows
  the popup again.
- While it plays the yard is paused (no `step`), the HUD, cards and buttons are hidden (`body.ending`), and a
  transparent blocker (`#endBlock`) keeps taps and drags off the yard.

## 7. Back home (game.js)

`endingHome()`: the camera goes back to where it was, the truck pulls in with Tinker in the back and Tinker hops off at
the curb, like coming home from a trip. V21 (`startEndReturn`, `updEndReturn`): Tinker stands still at the curb while the
camera closes in on its head; the truck (V21.1: drop-off only, no pickup) drives away, and 2 s after it has gone Tinker
slowly (at 22% speed) goes to a leaf a little way up the yard and picks it up,
then speeds up and picks up several more as the camera widens back to the yard. For this its list is just Gather leaves
(its own list waits in `S.flags.endKeep` and comes back on Continue, also after a reload). Then: the **"Great work!"** popup (`showEndPopup`, `#endPop`):
"You really did collect a lot of leaves" and a **Continue** button. Continue closes it and the yard just carries on;
there are no more milestones.

## How a scene is built (ending.js)

- Same world units and 3/4 view as the yard: the truck's lane at `y = LANE` (56), the curb at y 0–8, the gravel verge
  y −30–0, a building's front wall at `yf ≈ −38`. The truck is the yard's own (`drawTruckAt`), robots are drawn with
  the yard's `drawRobot`, so they look exactly like the yard's.
- A scene = a set (`under`: floor, back and side walls; `items`: machines and props, depth-sorted with the robots) + a
  crew + a script. Scripts and each robot's job are generator functions run by a tiny runner: `yield 2` waits 2 s,
  `yield () => cond` waits for a condition, `yield within(6, cond)` waits at most 6 s, `yield* walk(o, [[x, y], …])`
  walks a path. So the floor keeps working whatever the camera does.
- **Buildings you look into** (`drawShell`): until you're inside you see the front wall and the roof; once the robots
  are through the door they fade away (`B.reveal` 0 → 1) and a low wall with the doorways stays, like a doll's house.
  They come back as the robots walk out.
- **The visit** (`visit(sc)`, used by the factory and the bank): black → the truck arrives from the right with the
  camera close on it → the camera widens to the building → the driver steps out of the cab, Tinker hops off the back
  → both walk to the door and in → the walls fade → the scene's own `watch()` (camera moves) → they
  walk out, the walls come back → the scene's `leave()` if it has one → Tinker hops back in, the driver gets in the cab
  → the truck pulls away, the camera follows and closes in → black.
- Each floor runs for 8 s before you see it (`setup`, quietly) so it's already busy.
- **Nothing gives the secret away from outside** (`sc.open`, set as the robots step through the door): the factory's
  finished robots wait at the wall instead of riding out on the conveyor, and the bank's runner waits inside with its
  bundle instead of going out to the container.
- **Tinker is silent** in the ending (no "!" or "…" bubbles). V21: so is everyone else (the new robots' "!" and the
  inspector's "ok!" are gone), there's no "All aboard!" as Tinker climbs in, and the "new upgrade" arrows are hidden from
  the moment the truck camera starts to ride out.
- Robots' looks for the ending are registered on the yard's `ROBOT_LOOKS`: `hardhat` (yellow hard hat, high-vis
  stripe), `banker` (vest, shirt, bow tie, green eyeshade), and for new models `twin`, `dome`, `scope`. `look(shape, o)`
  makes a style from one of the yard's body shapes with new colours. `noPlate` / `noBasket` (new in drawRobot) leave
  off the number and the basket; `r.hold(c, hx, hy, r)` draws something held out in front (`holdUp` lifts it).
- Phones held upright: the camera never zooms out so far the robots get tiny (`ZMIN`); it pans across instead.

## Scene 1 — Robot factory (`makeFactory`)

**Idea:** iron ingots go in, new robots come out. The crew all wear yellow hard hats.

- **V21 outside:** corrugated walls with seams, steel columns with bolts, a concrete plinth, factory windows (one pane
  tipped open) with gooseneck lamps, the roller door's guides, header and hazard stripes, a vent box, a red hose box, a
  ladder to the roof; the roof has glazing bars, gutters, drifting reflections, fans in housings and an extractor duct.
- **Outside:** ribbed steel front, a big roller door, a plaque with a robot head over the man door, a sawtooth roof
  with skylights, roof fans, a water tank and a smoking chimney. Two pallets of ingots wait on the verge. The conveyor
  comes out of the right-hand wall on legs and disappears into a low covered chute.
- **Inside (left → right):** two ingot pallets → the **press** (one ingot → one body shell, with a thump and sparks) and
  the **wheel lathe** (one ingot → a set of treads) → **two assembly bays** (a shell + treads → a robot, welded over
  5 s: treads, body, head, then its eye lights up) → the new robot wakes up, queues and drives into the **paint booth**
  (coloured puffs come out of the vents) → it comes out as a new model and hops onto the **conveyor**, which carries it
  out through the wall (only once we're inside; until then they wait at the wall, a gap between each).
- **Crew** (`build()`, 15 robots): two ingot carriers side by side for each machine, a shell runner and a tread runner
  for each bay, a welder at each bay (torch up while welding), the press operator (wrench up while it presses), the
  inspector at the start of the belt (clipboard), and round the edges a sweeper going up and down the walkway, a
  robot fixing something at the workbench, and one moving crates from one stack to the other and back.
- **Props** (`props()`, no purpose shown): a pegboard of tools on the back wall (spanners, hammer, saw, pliers, cable),
  a workbench with a vice and a lamp, lockers, crate stacks, oil drums, a trash can (inside by the door and outside on
  the verge), a hand truck, a traffic cone, a fire extinguisher, a clock and a painted gear.
- **New models** (`MODELS`): mint with twin antennas, navy with a glass dome, lavender round with a periscope eye,
  orange-headed kettle, a sprout one, a rose-gold "Sterling", a sky-blue lantern bot, a patched one, an ember one, and a
  plain cream one that could be from your yard. None wear hard hats.
- **Camera** (`watch()`, V21.1): the whole floor, then close (`zTour`) and step by step: an ingot from the pallet to the
  press → the press stamping a shell → a runner taking it to a bay → the robot welded together → the paint booth → out on
  the belt → wide. While the camera is on a step, the machines of later steps run at 60% (`tempo(sc, step)`, `sc.focus`);
  the robots never slow down.
- **Layout:** building x −420…420, back wall y −350, front y −38, walls 104 high; truck stops at x −214, door at −300.
  Machines in `P`, their stock and timers in `M`.
- **Later:** more machines (a head press, an eye-lens station, a test track), robots stamping out blowers and shakers
  too, a foreman, sound for the belt.

## Scene 2 — Bank (`makeBank`)

**Idea:** leaves in, money out. The crew wear bank clothes: vests, bow ties, green eyeshades.

- **Outside:** cream stone front with columns and a pediment over the door (gold coin), tall lit windows, lanterns, a
  slate roof with a copper ridge, chimneys and a glass dome with a gold coin on top. **Massive heaps of leaves** along
  the curb, and a big green **cash container** by the side door.
- **V21 outside:** a rusticated base, pilasters, arched windows with glazing bars and keystones, a coin frieze and dentil
  cornice, the portico with fluted columns, a fanlight and steps (its pediment drawn in front of the roof edge), dormers,
  chimney pots, cresting on the ridge, and the dome in full (`drawDome`): a stone drum with pilasters and lit windows, a
  glass dome with lead ribs and rings, a shine and a drifting glint, a gold band, and a little lantern with the gold coin.
  The eyeshades are a stitched band with a buckle and a see-through green brim that tints the face under it.
- **Inside:** a checkered marble floor with a red carpet from the door, wood panelling, a framed golden leaf, a
  landscape, a clock, columns and the round vault door on the back wall. Left → right: two piles of **leaf bags** →
  the **shredder** (bags tipped into its hopper, blades turning, shreds fly over to a pot) → **two big copper pots**
  on brick stoves → the **roller mill** (buckets of green sludge go into its hopper; a big drum rolls it out) → one
  **long green sheet** along a table → the **cutter** (a guillotine chops it into notes onto a tray) → a robot
  **stacks** the notes into bundles on a table → a runner takes the bundles out of the side door to the container.
- **V21: pouring.** The shredder is lower, with a wide open hopper and a wooden step beside it (`STEP`). One carrier at a
  time climbs the step, holds the bag up over the hopper (`BAGAT`, drawn by `drawPour` with the robot's arms) and tips it:
  a stream of leaves pours in (`pourLeaf`) and heaps up in the hopper (`M.shred.pile`), sinking and churning while the
  blades chew. About one leaf in eleven misses and lands on the floor (`M.spill`); a **sweeper** picks those up one by one
  into a dustpan and tips them back into the hopper.
- **The pots run in batches** (`pot.st`): `fill` (the shredder fills it with leaf mash, brown) → `mix` (the chemist
  pours something in from a jug, the stirrer stirs it to a grey sludge) → `dye` (the chemist pours in the green
  colouring, it turns green) → `ready` (the bucket robots scoop it) → `fill` again. When we walk in, the back pot is
  already green and buckets are going back and forth to the mill, while the front pot goes through mix → dye → green
  in front of us.
- **Crew** (`build()`, 16 robots): three bag carriers, the chemist, a stirrer at each pot (long paddles going round),
  four bucket robots, the stacker, the cash runner, and round the edges a clerk stamping papers at a desk and a robot
  polishing the vault door, and (V21) the sweeper picking up spilled leaves.
- **Props** (`props()`, no purpose shown): the clerk's desk with a green lamp and papers, potted plants, a water
  cooler, filing cabinets, a coat stand with a bowler hat and an umbrella, rope barriers along the carpet, a trash can.
- **Leaving** (`leave()`): the horn, and all the cash in the container flies into the back of the truck, the way the
  leaves fly in at the yard; the cash rides along in a pile on the bed.
- **V21.1 baggers:** three robots on the curb scoop leaves from the heaps into bags and carry them in through the front
  door to the bag piles (`M.piles`, drawn by count); the carriers take them from there. Each bag pours ~60 leaves.
- **Camera** (V21.1): wide, then close and step by step: a bagger filling a bag outside and carrying it in → a bag poured
  into the shredder → the pots, mixed and dyed green → a bucket to the mill → the sheet, cutter and stacks → the runner
  out to the container → wide. Later steps' machines run at 60% meanwhile (`tempo`).
- **Layout:** building x −400…400, back wall −340, front −38, walls 104 high; truck stops at x −150; main door −262,
  side door 312; container at (356, −10). Positions in `P` and `POTS`, the machines' state in `M`.
- **Later:** a counter with a teller, coins as well as notes, the vault door opening, a robot counting money.

## Scene 3 — Storage (`makeStorage`, `storageRide`)

**Idea:** where it all ends up. No stop: the truck drives slowly past a very long brick storehouse, and through window
after window there are shelves of honey jars and mushroom cans, aisle behind aisle. It never ends; the picture fades to
black while the truck is still driving.

- The front is drawn for whatever is on screen, so it really doesn't end. Each window is one of three pictures
  (`windowView`, drawn once) with three racks at different depths and a hanging lamp. V21: every shelf has four honey
  jars to every mushroom can (three different patterns), every fourth bay is a loading door with a hoist beam, and the
  front has arched brick lintels, a corbelled cornice, downpipes, and skylights and turning ventilators on the roof.
- **Later:** forklift robots inside, labels on the shelves, a glimpse of the yard's own bags and ingots stored too.

## Ideas not done (yet)

- A short drive between the scenes (only the zoom-in and cut for now).
- Music for the ending.
- Credits text, if wanted (the scenes don't name anything on purpose).
