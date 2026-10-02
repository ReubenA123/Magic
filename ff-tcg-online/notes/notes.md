# Known engine gaps — come back to these

A sweep of every "deferred" / "approximated" / "known gap" comment already left in
`server/src/data/cards.ts`, `server/src/types.ts`, `server/src/engine/actions.ts`,
`server/src/engine/effects.ts`, and `server/src/engine/combat.ts` (mirrored byte-for-byte
in `client/src/`). These are intentional, documented simplifications — not bugs nobody
noticed — but they're real divergences from printed card text or real architectural
holes worth planning around. Line numbers are approximate (the files keep growing).

## Stack / priority gaps

This engine has no stack or priority system at all — a spell resolves the instant
it's cast, so nothing can ever "respond" to it. This blocks an entire category of
counterspell-style cards:

- **Absolute Virtue** — "can't be countered" is moot; "protection from each opponent" also deferred (no `protection` keyword exists at all). `cards.ts:37`
- **Altered Ego** — "can't be countered" left as flavor text only. `cards.ts:149`
- **An Offer You Can't Refuse** — "Counter target noncreature spell" has no `onCast` at all. `cards.ts:178`
- **Syncopate** / **Swallowed by Leviathan** — "Counter target spell unless..." deferred; would need a whole new announce → priority → resolve casting pipeline. `cards.ts:5215`, `cards.ts:5194`
- **Endless Detour** — "target spell" mode has no analog (no stack); "card in a graveyard" mode also deferred (no unified battlefield-or-graveyard target picker). `cards.ts:1409`, `types.ts:1968`
- **Louisoix's Sacrifice** — prints a counter-ability, no implementation at all.

## Targeting / distribution simplifications

No "choose any number from many" or multi-target-split mechanism exists. The
established fallback is "approximate down to a single target or ALL targets":

- **Forgotten Ancient**, **Resourceful Defense** (`{4}{W}` ability), **Nesting Grounds**, **Rikku, Resourceful Guardian** (Steal), **Tidus, Yuna's Guardian** — all "move any number of counters" effects approximated as moving ALL of the highest-count counter label to ONE target, or auto-picking the counter label when more than one kind exists. `types.ts:2220-2373`
- **ProliferateEffect** — real Proliferate also covers player-level counters; this engine has no player-level counters at all, so only permanents are eligible. `types.ts:1096`
- **Garnet, Princess of Alexandria** — "remove a lore counter from each of any number of Sagas" deferred entirely. `cards.ts:1850`
- **Gilgamesh, Master-at-Arms** — "put any number of Equipment cards from among them onto the battlefield" deferred. `cards.ts:1925`
- **Sin, Unending Cataclysm** — "remove all counters from any number of..." approximated as stripping EVERY counter from EVERY qualifying permanent on both sides, not a chosen subset. `types.ts:1772`
- **Sephiroth, One-Winged Angel** — "sacrifice any number of other creatures, draw that many" deferred.
- **Qutrub Forayer** — mode 2 (exile up to two cards from one graveyard) deferred; no modal-choice UI exists for `onEnter` effects at all.
- **Phoenix, Warden of Fire** (Saga ch. III) — "return any number of creatures, total MV ≤6" deferred (no budget-constrained multi-pick).
- **Light of Judgment** — "destroy up to one Equipment attached to that [already-targeted] creature" deferred (dependent two-stage target, unsupported shape).
- **Delivery Moogle** — "search library and/or graveyard" approximated as always searching both and always shuffling, not a genuine either/or branch. `types.ts:1242`

## Mode / clause omissions (part of a card is implemented, part isn't)

A long tail of individual cards where one mode/clause works and another doesn't,
usually because the missing half needs a mechanism nothing else in the engine has
yet (modal-ability UI, forced blocks, counter-doubling, replacement effects on
amounts, spell-copying, play-from-library, etc.). Full list, each is a single
distinct card:

Phoenix Down, Poison the Waters, Ice Magic (Blizzara/Blizzaga), Tifa's Limit Break
(Meteor Strikes/Final Heaven), Astrologian's Planisphere, Cloud Midgar Mercenary,
Ardyn the Usurper, Balthier and Fran, Dion Bahamut's Dominant, Firion Wild Rose
Warrior, Kefka Court Mage, Rinoa Heartilly, Sazh Katzroy, Vaan Street Thief, Esper
Terra, Summon: Bahamut/Brynhildr/Esper Ramuh/Fenrir/G.F. Cerberus/Leviathan/Primal
Garuda/Titan, The Darkness/Earth/Fire/Water/Wind Crystal, The Wandering Minstrel,
The Lunar Whale, The Masamune, The Prima Vista, The Regalia, Ultima Weapon, White
Auracite, Yuna Hope of Spira, Zack Fair, Summoner's Grimoire, Triple Triad,
Traveling Chocobo, Torgal A Fine Hound, Weapons Vendor, Shambling Cie'th,
Unexpected Request, Stolen Uniform, Ride the Shoopuf, Namazu Trader, Sandworm,
Seifer Almasy, Sephiroth Fabled Soldier, Sephiroth Planet's Heir, Serah Farron,
Sidequest: Card Collection/Catch a Fish/Hunt the Mark, Lion Heart, Magitek Scythe,
Relentless X-ATM092, Item Shopkeep, Raubahn Bull of Ala Mhigo, Blitzball Stadium,
Sleep Magic, Fang Fearless l'Cie, Ancient Adamantoise, Cecil Dark Knight, Fate of
the Sun-Cryst, Nibelheim Aflame, Retrieve the Esper, Esper Origins, Prishe's
Wanderings, Gladiolus Amicitia, Black Chocobo, Sorceress's Schemes, Kimahri
Valiant Guardian (copy = power/toughness only, not a true copy), Zodiark Umbral
God, Gatta and Luzzu (combat damage only, not all damage).

See the full agent report in git history / session log for the exact comment +
line number on each — there are ~55 of these and most are genuinely one-off.

## Mana / provenance gaps

The mana pool is just a count per color — nothing remembers which tap produced
which mana once it's pooled. This blocks "when *that* mana is spent on X":

- **Path of Ancestry** — "when that mana is spent on a creature spell sharing a type with your commander, scry 1" approximated as "the very next spell this controller casts" (see `GameState.pendingManaIdentitySourceScry`). Misfires if other mana gets spent first. Also: "Scry" has no distinct implementation anywhere in this engine — always resolved as Surveil 1. `types.ts:2281`, `types.ts:4559`
- **Arcane Signet / Command Tower** (commander color identity) — approximated as just the commander's own printed mana-cost colors; real color identity also reads rules/reminder text, which has no generic extraction here. `types.ts:2973`
- **Cargo Ship** — "spend this mana only on artifact spells" not enforced (produces plain colorless).
- **Flooded Grove / Starting Town** — hybrid-symbol mana abilities deferred; `parseCostLabel` has no `{G/U}` concept.
- **A Realm Reborn** (`grantsManaAbilityToOthers`) — real rules would let a permanent stack an existing mana ability with a granted one; this only grants to permanents with none. `actions.ts:450`

## Collision risks (simultaneous triggers can clobber shared pending-state)

Several `pendingX` fields are single-slot, so two things wanting the same slot at
once will silently stomp each other:

- **Collective Effort** — modes 1 & 2 both arm `pendingTarget` via `destroyTarget`; choosing both in one cast clobbers the first before the player acts on it. Only mode 3 (separate `pendingPlayerTarget`) is safe. `cards.ts:999`
- **Farewell** (`ExileAllEffect`) — doesn't route a hit commander through `beginCommanderZoneChoice` (built for one permanent at a time); a commander caught by Farewell just goes straight to exile. `types.ts:2176`
- **Resourceful Defense** (added this session) — its dead-permanent counter-pickup arms `pendingTarget` per death; if a board wipe kills two counter-bearing permanents the controller owns in the same resolution, the second death's target silently overwrites the first's before it's resolved. Not yet fixed — same class of bug `pendingCounterTransferQueue` and `beginCommanderZoneChoice` were built specifically to avoid elsewhere.
- `GameState.pendingCounterTransferQueue` and `beginCommanderZoneChoice` are the two places this was actually *fixed* (queued instead of clobbered) — good reference implementations if Resourceful Defense above needs the same treatment.

## AI auto-resolver gaps (human or AI could get stuck waiting)

- **No AI auto-resolver exists for `pendingSurveil` or `pendingHideaway` at all.** Confirmed pre-existing, not something introduced this session — but it means **Path of Ancestry** (scry→surveil) and **Fight Rigging** (Hideaway 5) will leave the AI opponent stuck on its own turn if it ever draws and plays either one. Needs a `useLocalGame.ts` handler for both, same pattern as the existing `pendingLibrarySearch`/`pendingExplore`/`pendingManaColorChoice` handlers.
- `resolveSacrificeQueue`, `resolveKeepOneSacrificeRestQueue`, and `isLegalPendingTarget` all DO have AI handling already — not gaps, just confirming the pattern that's missing for surveil/hideaway.

## Legend rule

`checkLegendRule` is **only a log line** — this engine never actually auto-sacrifices
a duplicate legendary; players are expected to self-adjudicate. `effects.ts:2648`.
Two related corner cases: `CreateTokenIfNotControllingNamedEffect` has to work around
this manually, and `exileAndReturnTransformed` does **not** re-check the legend rule
after a transform (left for the caller).

## Other architecture-wide approximations

- **"Deals combat damage to a player" ≈ "is unblocked"** everywhere — misses trample damage that reaches the player through a blocker. Affects every `onCombatDamageToPlayer`-family card (Squall SeeD Mercenary, Ultimecia Temporal Threat, Sphere Grid, Tidus's Cheer, Bred for the Hunt, Buster Sword, Thief's Knife, Kain Traitorous Dragoon, **Grateful Apparition**, Locke Cole, Reno and Rude, Lightning Security Sergeant, ...). `actions.ts:5477`
- **"Entered this turn" ≈ `CardInstance.summoningSick`** — breaks for anything that also has haste (summoningSick is already false). Affects Cactuar, Forge of Heroes, Tromell's proliferate-count. `types.ts:1122`
- **`grantsOtherNontokenCreaturesExtraCounterOnEnter`** (Tromell) — a creature entering via reanimation (or any non-cast path) skips this bonus; only `triggerCreatureEnterWatchers`'s own call sites grant it. `types.ts:3729`
- **A transformed back face's own `onDeath` is a latent landmine** — `moveCreaturesToGraveyard` writes the FRONT face's defId before `resolveOnDeathTriggers` re-reads it, so a back face's own `onDeath` would never fire. No current card has one, so it hasn't bitten yet. `combat.ts:1148`
- **Luminous Broodmoth**'s "without flying" check only sees printed/temporarily-granted flying, not a board-anthem grant, at time of death. `combat.ts:1341`
- **A dying commander skips `temporaryOnDeathReturnTapped`/`temporaryOnDeathPutCountersEqualToPower`** while its command-zone-vs-graveyard choice is still pending. `effects.ts:360`
- **Ultima, Origin of Oblivion**'s blight-counter override only actually consumes the mana-production half (`overridesProducesMana`); `overridesSubtype` is registered but nothing reads it. `combat.ts:15`
- No emblem system, no spell-copy mechanism, no "play from a zone other than hand" persistent mechanic, and no forced-block enforcement exist anywhere yet — each blocks a small handful of cards listed above under "Mode/clause omissions."
- No general replacement-effect system for amounts (damage/mill/life-gain) beyond the one-off cases already built (Hardened Scales, finality counters, `onDeathExileAndCreateTokens`) — blocks The Water/Wind/Earth Crystal.

## This session's own new caveats (2026-10-02 batch — recap, already flagged in chat)

- **Gatta and Luzzu** — damage-prevention scoped to combat damage only (same `markDamage`-is-the-only-choke-point reason as the general note above).
- **Forgotten Ancient** — counter redistribution moves ALL counters to ONE target, not a player-chosen split (see "Targeting/distribution" above — this is the same family, just called out again since it's new).
- **Rampant Rejuvenator**'s death search now allows duplicate basic-land names (fixed this session) — no longer a gap.
- **Scholar of New Horizons**'s battlefield-vs-hand choice is now a real player decision (fixed this session) — no longer a gap.
- **Path of Ancestry**'s mana-identity scry now works via the "next spell cast" approximation described above under "Mana / provenance gaps" — not a full fix, but a real implementation rather than a no-op.
