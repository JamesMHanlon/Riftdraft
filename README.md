# Rift Draft

A League of Legends drafting game. You're shown three champions, keep one, and repeat until you have five. Then you click role icons to set your lanes, and an AI analyst plays out the game.

## Modes

- **Solo Gauntlet** (main mode): draft a team, then fight through a 4, 8 or 16-team knockout bracket of bot teams.
- **Practice Duel**: a best-of-3 against a bot, using the same rules as an online duel.
- **Online Duel**: a 1v1 best-of-3 against a friend.
  - You take turns picking in pro draft order: Blue picks 1, 4, 5, 8, 9 and Red picks 2, 3, 6, 7, 10.
  - No champion is offered twice in a game, and only the picker sees their three options.
  - Sides swap for Game 2. The loser of Game 2 gets Blue side (first pick) in Game 3.
  - There's an optional pick timer. If it runs out, a champion is picked for you.

## How games are decided

`public/engine.js` simulates early, mid and late game. It weighs:

- each champion's early-game, late-game and teamfight ratings
- whether the champion is on its natural role (off-role is −28%)
- damage mix (AD/AP), frontline and crowd control
- **counter matchups**:
  - hard counters from the `COUNTERS` list in `public/data.js` (e.g. Teemo vs Darius, Malphite vs Yasuo)
  - class matchups (assassin vs mage, tank vs assassin, fighter vs tank…)
  - ranged vs melee in top and mid

Lane counters swing the laning phase, and counters across the whole team shift the mid and late game. To change balance, edit the champion numbers or the `COUNTERS` list in `public/data.js`.

## Hosting on your website

There are two ways to host it. Online duels work with either.

### Option A: Node.js hosting (recommended for online play)

Use this if your host can run Node 18+ (e.g. Render, Railway, Fly.io, a VPS):

```bash
npm install
npm start
```

The server serves the game and relays duel messages over WebSockets on `/ws`. It uses `PORT` if the host sets it, and defaults to 3000. Room codes are 4 letters.

### Option B: Static hosting only

Use this for GitHub Pages, Netlify, cPanel, or any plain file host. Upload the **contents of `public/`**.

With no server available, online duels connect the two browsers directly (peer-to-peer). This uses PeerJS's free public connection broker, and room codes are 5 characters. It works for most players. A few strict networks (some school, office or mobile connections) block direct connections, and then Option A is more reliable.

If the game page is static but you run `server.js` somewhere else, set `window.RIFT_DRAFT_SERVER = "wss://your-server/ws"` in `public/index.html`.

Champion art loads from Riot's Data Dragon CDN. Rift Draft is a fan project and isn't endorsed by Riot Games.
