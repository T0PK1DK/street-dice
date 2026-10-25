# Street Dice

Casual player-banked street craps for friends. No house, no build, no server required.

## Play

Open `index.html` in a browser (keep `engine.js` next to it). Or from this folder:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

- Tap a player to hold their stack (pass-and-play)
- Shooter posts the line; everyone else fades until it's covered
- Optional room bets: one player offers, another covers at true odds
- Throw at the wall

Come-out: 7 or 11 wins the line, 2/3/12 the fade scoops it, anything else is the point. Then hit the point before a 7. Seven-out and the dice walk. Craps on the come-out loses the line, but the shooter keeps the rocks.

## Room odds

- Point vs 7: 4/10 is 2:1, 5/9 is 3:2, 6/8 is 6:5
- Next-roll 7 is 5:1, 11 is 17:1, any craps is 8:1
- Hard 4/10 is 8:1, hard 6/8 is 10:1

Crew and bankrolls save in this browser (`street-dice-v2`). Reset is in Crew.

## Tests

Rules and settlement live in `engine.js` so Node can run them without a bundler.

```bash
npm test
```

MIT. Sounds are synthesized in the page. No third-party assets.
