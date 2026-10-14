AUTUMNATION — SEPARATE YARD MUSIC STUDIES

Open index.html in a browser, or play the four WAV files directly.
Nothing in public/, the game, its save data or its audio scheduler was changed.
This folder is outside the game's public deployment directory.

Basis: inspected public/audio.js and the older location2/location3 audio.js.
Their shared score is a 78 BPM, 3/4 waltz in F major with major-seventh colours,
sine/tine plucks, low rounded bass, soft detuned pads and dark reverb.
The prairie has flowers, petals and bees; the hollow has rain, mushrooms,
wood, mist and warm lights. The new melodies follow these settings.

01 Petal Waltz — 82 BPM, F major. Closest stylistic match; gently brighter.
02 Clover & Honey — 76 BPM, F major. More space and high answering notes.
03 Lanterns in the Rain — 66 BPM, D minor/F major. Warm, reflective shelter.
04 Puddle Postcards — 70 BPM, G minor/B-flat major. Curious and softly playful.

All four are new, fixed compositions. Instrument synthesis is an approximation
of the game's palette, not an exact Web Audio engine render. No vocals, drums,
rain recordings or game effects are mixed in. These are finite evaluation
sketches, not seamless game loops. Long in-game silences are omitted.

Each piece: 2-bar intro, 8-bar A, 8-bar B, 8-bar A return, 2-bar ending + tail.
Audio: 44.1 kHz, stereo, 16-bit PCM WAV, matched RMS with peak headroom.
Editable scores: *.score.json. Renderer and composition source: render.cjs.
Regenerate with Node.js: node render.cjs (from this directory).
The renderer uses only Node built-ins and writes only within this folder.
manifest.json includes duration, score metadata and measured level values.
