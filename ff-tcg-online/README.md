# Magic

A private, two-player card game app, reskinned around Final Fantasy
characters, built to play online with one other person behind a shared
password. Not for distribution or monetization - see **A note on the card
art and IP** below.

## How this works

This is a **shared digital tabletop**, not a rules engine. It tracks where
cards are (hand/battlefield/graveyard/exile/library), whether they're
tapped, what counters are on them, and life totals - but it never reads a
card's text and decides what happens. You and your brother do that part
yourselves, the same way you would across a real table: cast a spell, do
the math, click the buttons that reflect what just happened.

That trade-off is deliberate. It means every card "just works" the moment
you add it to `data/cards.ts` - no scripting a single card's behavior - at
the cost of the app not stopping you from doing something illegal. For two
people who know the rules and trust each other, that's a good trade.

## Project layout

```
ff-tcg-online/
  server/   Node/TypeScript server (Express + Socket.io) - the source of truth for game state
  client/   React/TypeScript web client (Vite)
```

Clients never mutate game state directly - they send an intent ("move this
card to my graveyard," "tap this creature," "I'm ready to start"), the
server applies it and broadcasts the result to both players. This is what
keeps both screens in sync.

## Getting started

You'll need [Node.js](https://nodejs.org) 18+.

**1. Install dependencies:**
```bash
cd server && npm install
cd ../client && npm install
```

**2. Set your shared password:**
```bash
cd server
cp .env.example .env
# edit .env, set GAME_PASSWORD to something only you and your brother know
```

**3. Run both packages (two terminals):**
```bash
# terminal 1
cd server && npm run dev

# terminal 2
cd client && npm run dev
```

Client: `http://localhost:5173`. Server: `http://localhost:4000`. Both of
you log in with a name and the shared password.

## Playing over the internet

Running `npm run dev` only makes the game reachable on your own machine. To
actually play with your brother, put the server (and ideally the built
client) somewhere both of you can reach:

- **A small VPS**: `npm run build && npm start` in `server/`; serve the
  client's production build (`npm run build` in `client/`, outputs to
  `client/dist/`) as static files, either from the same Express server
  (`app.use(express.static('../client/dist'))` in `server/src/index.ts`) or
  from any static host.
- **A tunnel tool** (`ngrok`, `cloudflared tunnel`) pointed at your local
  server, if you just want to play for an evening without deploying
  anything permanently.

The password is the only thing protecting the game once it's reachable
from the internet - keep it private.

## How a game actually flows

1. **Login** - name + shared password.
2. **Pregame** - your hand starts empty. Draw cards with the "Draw a card"
   button; click any card in your hand to shuffle it back into your
   library (this is the "milling" you asked for - it reshuffles
   automatically); draw more; repeat until you like your hand. Press
   **Ready**. Once both players are ready, turn 1 begins.
3. **Turns** - the active player does whatever they want (play cards, tap
   things, adjust life, add counters), using **Next phase** to move the
   reference phase label along if they want it, then presses **End turn**
   when done. Ending a turn automatically untaps the other player's
   battlefield for them.
4. **Undo** - bottom-left corner, any time. Steps back through the last
   several actions (server keeps the last 25 states) - click it repeatedly
   to go back further.
5. **Concede** - also bottom-left, ends the game and declares your
   opponent the winner.

## The card panel - how everything actually gets done

Click any card, in any zone, on either side of the board (yours or your
opponent's - see "Why either player can touch any card" below), and a panel
opens with:
- **Tap / Untap** (battlefield only)
- **Move to** any other zone - hand, battlefield, graveyard, exile, or
  library (moving to library shuffles it in immediately)
- **Counters** - existing counters show with +/- steppers; type any label
  (e.g. "+1/+1", "poison", "loyalty") and click Add to create a new one

Graveyards and exile are public zones - click "Graveyard (n)" or "Exile (n)"
under either player's battlefield to browse and act on what's there (handy
for reanimation-style effects).

### Why either player can touch any card

Real games constantly require affecting your opponent's stuff - tapping
their creature, killing it (moving it to their graveyard), putting a
counter on it from your removal spell. Rather than build a permissions
system around that, this app just lets either player act on any card. It's
built for two people who trust each other, not as an anti-cheat system.

## What's in the card pool

`server/src/data/cards.ts` (and its duplicate at `client/src/data/cards.ts`
- see the comment at the top of that file for why it's duplicated) has 19
sample cards: 5 lands and 14 creatures/spells/artifacts with real,
full rules text, reskinned around Final Fantasy. Both players currently
play an identical fixed 40-card decklist - there's no deck builder yet.

**Adding a card** is pure data entry: copy an existing entry, give it a
unique `id`, write real text. Nothing needs to be "wired up" - the engine
doesn't parse text, so accurate flavor and accurate rules text are the same
effort. Do the same edit in both copies of the file.

## What's deliberately not built yet

- **A deck builder** - both players play the same fixed list right now.
- **Reconnect/session robustness** - the server holds one game in memory;
  restarting it ends the match.
- **A coin flip** - player one always goes first.
- **Search/browse-your-own-library** - useful for "search your library for
  a card" effects; right now the closest equivalent is drawing cards one at
  a time during the pregame step. Could be added as a "peek at top N cards"
  action if it comes up often.

## Adding card art

See `client/public/assets/cards/README.md` - drop an image named after a
card's `id` into that folder and it's picked up automatically. Until then,
every card renders as a placeholder box with its name, cost, and text, so
the game is fully playable without any art.

## A note on the card art and IP

Final Fantasy characters and any official card art belong to Square Enix.
This project is set up for exactly what you described: a private,
password-gated, non-commercial game between you and your brother. Keep it
that way - don't make the repo or the running game public, and don't add
monetization. If you scan your own physical cards for art, that's the
cleanest option; pulling images from Square Enix's own TCG site or fan
wikis for this kind of private use is lower-risk than public use, but none
of it is an explicit license to redistribute, so treat the art as something
you're borrowing quietly rather than something you own.
