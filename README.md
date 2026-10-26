# Street Dice

Casual player-banked street craps for friends on one phone. No house, no real payments, no build step.

## Play

Keep `index.html` and `engine.js` together. Open the HTML file, or:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

The table is a **Three.js** scene (MIT, pinned CDN `three@0.160.1`). If WebGL or the CDN fails, it falls back to a 2D curb. `?2d=1` forces the fallback. `prefers-reduced-motion` skips the tumble and lands the decided faces immediately.

1. Name the crew on a new wall (or after Reset). Each friend starts at $200 play money
2. Pass the phone — the handoff names who is up and shows their stack
3. Shooter stacks chips ($1 / $5 / $10 / $20 / custom), undo last / clear, confirm to post the line
4. Pass to a fader. They fade until the line is covered
5. Optional **room** tickets (he hits / he don't) and **side** tickets (next 7/11, craps, hardways): offer, pass, cover at true odds
6. Shooter flicks the alley at the wall, or holds-and-releases the throw bar
7. Read the roll callout, then the payout card, then pass again

The roll is decided by the engine *before* the dice move. The animation only lands on those faces.

Come-out: 7 or 11 wins the line, 2/3/12 the fade scoops it, anything else is the point. Then hit the point before a 7. Seven-out and the dice walk. Craps on the come-out loses the line, shooter keeps the rocks.

## Room odds

- Point vs 7: 4/10 is 2:1, 5/9 is 3:2, 6/8 is 6:5
- Next-roll 7 is 5:1, 11 is 17:1, any craps is 8:1
- Hard 4/10 is 8:1, hard 6/8 is 10:1

Crew and bankrolls save in this browser (`street-dice-v2`). Reset in Crew returns to the named-crew setup. Landscape phones put the crew on the left and the chip tray on the right.

## Tests

Rules, settlement, and chip undo live in `engine.js` so Node can run them without a bundler.

```bash
npm test
```

MIT. Sounds are synthesized in the page. Three.js is MIT via the pinned CDN. No other third-party assets.
