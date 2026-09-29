# Counter Blitz — cards still needed in cards.ts

Deck: **Counter Blitz** (Final Fantasy Commander, 2025-06-13), commander
**Tidus, Yuna's Guardian**. This is a real Commander decklist (many of these
are unmodified Magic: The Gathering cards, others are FF-character reskins
of MTG creatures) — I didn't fabricate stats/rules text for any of these, so
they're listed here for you to add with the real numbers/wording once you
have them, rather than guessed.

Already in the pool (no action needed): **Forest**, **Island**, **Plains**.

Everything else below (97 cards, including the commander) needs a
`CardDefinition` entry in `server/src/data/cards.ts` (mirrored to
`client/src/data/cards.ts` the same way every other card change in this repo
is mirrored). Once a card exists with a real id, the Counter Blitz deck can
actually be published through the new Decks tab (Decks → Publish a deck) —
right now it can't be seeded at all, since none of its 97 missing cards have
an id to reference yet.


## Commander (1)

- Tidus, Yuna's Guardian — `{G}{W}{U}`

## Creature (34)



- Bane of Progress — `{4}{G}{G}`
- Chasm Skulker — `{2}{U}`
- Chocobo Knights — `{3}{W}`
- Duskshell Crawler — `{1}{G}`
- Fathom Mage — `{2}{G}{U}`
- Forgotten Ancient — `{3}{G}`
- Gatta and Luzzu — `{2}{W}`
- Generous Patron — `{2}{G}`
- Grateful Apparition — `{1}{W}`
- Gyre Sage — `{1}{G}`
- Incubation Druid — `{1}{G}`
- Kimahri, Valiant Guardian — `{2}{G}{U}`
- Lord Jyscal Guado — `{1}{W}`

- Luminous Broodmoth — `{2}{W}{W}`
- Maester Seymour — `{2}{G}`
- O'aka, Traveling Merchant — `{1}{U}`
- Rampant Rejuvenator — `{3}{G}`
- Rikku, Resourceful Guardian — `{2}{U}`
- Scholar of New Horizons — `{1}{W}`
- Shelinda, Yevon Acolyte — `{G}{W}`
- Sin, Unending Cataclysm — `{5}{G}{U}`

- Sunscorch Regent — `{3}{W}{W}`
- Tireless Tracker — `{2}{G}`
- Tromell, Seymour's Butler — `{2}{G}`
- Wakka, Devoted Guardian — `{2}{G}{W}`
- Walking Ballista — `{X}{X}`


## Instant (8)


- Destroy Evil — `{1}{W}`
- Endless Detour — `{G}{W}{U}`
- Inspiring Call — `{2}{G}`
- Path to Exile — `{W}`
- Protection Magic — `{1}{W}`
- Pull from Tomorrow — `{X}{U}{U}`


## Sorcery (7)

- Collective Effort — `{1}{W}{W}`
- Damning Verdict — `{3}{W}{W}`
- Farewell — `{4}{W}{W}`
- Farseek — `{1}{G}`
- Promise of Loyalty — `{4}{W}`
- Three Visits — `{1}{G}`


## Artifact (4)

- Arcane Signet — `{2}`
- Blitzball Stadium — `{X}{U}`
- Everflowing Chalice — `{0}`
- Sol Ring — `{1}`

## Enchantment (9)

- Bred for the Hunt — `{1}{G}{U}`
- Fight Rigging — `{2}{G}`
- Hardened Scales — `{G}`
- Inexorable Tide — `{3}{U}{U}`
- Path of Discovery — `{3}{G}`
- Resourceful Defense — `{2}{W}`
- Sphere Grid — `{1}{G}`
- Summoner's Sending — `{1}{W}`
- Together Forever — `{W}{W}`

## Land (34 nonbasic, still missing)

- Ash Barrens
- Brushland
- Canopy Vista
- Command Tower
- Evolving Wilds
- Exotic Orchard



- Glacial Fortress
- Hinterland Harbor
- Idyllic Beachfront
- Nesting Grounds
- Overflowing Basin
- Path of Ancestry
- Port Town
- Prairie Stream
- Radiant Grove
- Seaside Citadel
- Skycloud Expanse
- Sungrass Prairie
- Sunpetal Grove
- Tangled Islet
- Temple of Enlightenment
- Temple of Mystery
- Temple of Plenty
- Temple of the False God
- Vineglimmer Snarl

(Forest ×3, Island ×3, Plains ×3 from the original 37-land list are already
covered by the existing basic lands.)
