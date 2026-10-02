import { applyAction } from './engine/actions';
import { createInitialState, nextInstanceId } from './engine/state';
import { moveCreaturesToGraveyardAndTrigger, resolveCardEffects } from './engine/effects';
import { hasBoardGrantedKeyword } from './engine/combat';
import { getCardDefinition } from './data/cards';
import { CardInstance, GameState } from './types';

function must(cond: boolean, label: string): void {
  if (!cond) {
    console.error('FAILED:', label);
    process.exit(1);
  }
  console.log('ok:', label);
}

function card(defId: string, overrides: Partial<CardInstance> = {}): CardInstance {
  return { instanceId: nextInstanceId(), defId, ownerId: 'you', tapped: false, counters: [], damageMarked: 0, summoningSick: false, ...overrides };
}

function withBattlefield(state: GameState, playerId: string, cards: CardInstance[]): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, ...cards] } } : p)) as GameState['players'],
  };
}

function withHand(state: GameState, playerId: string, cards: CardInstance[]): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, zones: { ...p.zones, hand: [...p.zones.hand, ...cards] } } : p)) as GameState['players'],
  };
}

function withGraveyard(state: GameState, playerId: string, cards: CardInstance[]): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, zones: { ...p.zones, graveyard: [...p.zones.graveyard, ...cards] } } : p)) as GameState['players'],
  };
}

function findOn(state: GameState, ownerId: string, instanceId: string): CardInstance | undefined {
  return state.players.find((p) => p.id === ownerId)!.zones.battlefield.find((c) => c.instanceId === instanceId);
}

function counterAmount(c: CardInstance | undefined, label: string): number {
  return c?.counters.find((ctr) => ctr.label === label)?.amount ?? 0;
}

function act(state: GameState, playerId: string, action: Parameters<typeof applyAction>[1]): GameState {
  const result = applyAction(state, action, playerId);
  if (!result.ok) {
    console.error('ACTION FAILED:', JSON.stringify(action), result.error);
    process.exit(1);
  }
  return result.state;
}

function freshState(): GameState {
  let state = createInitialState('You', 'Opp', 'you', 'opp');
  state = { ...state, mutualAdjustment: { status: 'active', agreedBy: ['you', 'opp'] }, phase: 'main1', activePlayerId: 'you' };
  return state;
}

function getPlayerMana(state: GameState, playerId: string, color: 'W' | 'U' | 'B' | 'R' | 'G' | 'C'): number {
  return state.players.find((p) => p.id === playerId)!.manaPool[color];
}

// ---------------------------------------------------------------------------
// Anger: graveyard-sourced haste grant, conditional on controlling a Mountain
// ---------------------------------------------------------------------------
{
  let state = freshState();
  state = withGraveyard(state, 'you', [card('anger')]);
  const bearId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('gran-pulse-ochu', { instanceId: bearId, summoningSick: true })]);
  const bear = findOn(state, 'you', bearId)!;
  must(!hasBoardGrantedKeyword(state, 'you', bear, getCardDefinition('gran-pulse-ochu'), 'haste'), 'Anger: no haste grant without a controlled Mountain');
  state = withBattlefield(state, 'you', [card('mountain')]);
  must(hasBoardGrantedKeyword(state, 'you', bear, getCardDefinition('gran-pulse-ochu'), 'haste'), 'Anger: grants haste to controlled creatures once a Mountain is controlled');
}

// ---------------------------------------------------------------------------
// Banon: Pray (cast creature from graveyard if not from battlefield, once
// per turn) + attack trigger (may pay mana, discard then draw)
// ---------------------------------------------------------------------------
{
  let state = freshState();
  const banonId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('banon-the-returners-leader', { instanceId: banonId, summoningSick: false })]);

  // A creature that died in combat (graveyardEntrySource: 'battlefield') is NOT eligible.
  const diedInCombatId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('gran-pulse-ochu', { instanceId: diedInCombatId })]);
  const killed = moveCreaturesToGraveyardAndTrigger(state, [diedInCombatId], 'is destroyed');
  state = { ...killed.state, log: [...killed.state.log, ...killed.logLines] };
  const diedCard = findOn(state, 'you', diedInCombatId);
  must(diedCard === undefined, 'sanity: the creature actually left the battlefield');
  const inGraveyard = state.players[0].zones.graveyard.find((c) => c.instanceId === diedInCombatId)!;
  must(inGraveyard.graveyardEntrySource === 'battlefield', "Banon: a combat death is tagged graveyardEntrySource: 'battlefield'");
  const badPray = applyAction(state, { type: 'CAST_CREATURE_FROM_GRAVEYARD_VIA_GRANT', instanceId: diedInCombatId }, 'you');
  must(badPray.ok === false, "Banon: Pray rejects a creature that died from the battlefield");

  // Discard a creature (graveyardEntrySource: 'other') - eligible.
  const discardId = nextInstanceId();
  state = withHand(state, 'you', [card('gran-pulse-ochu', { instanceId: discardId })]);
  state = { ...state, pendingDiscard: { sourceInstanceId: banonId, controllerId: 'you', count: 1 } };
  state = act(state, 'you', { type: 'DISCARD_CARD', instanceId: discardId });
  const discarded = state.players[0].zones.graveyard.find((c) => c.instanceId === discardId)!;
  must(discarded.graveyardEntrySource === 'other', "Banon: a discard is tagged graveyardEntrySource: 'other'");

  // Mutual Adjustment bypasses mana costs AND the once-per-turn limit, so
  // turn it off for this specific check and pay the real {G} cost by hand.
  state = { ...state, mutualAdjustment: { status: 'inactive', agreedBy: [] } };
  state = { ...state, players: state.players.map((p) => (p.id === 'you' ? { ...p, manaPool: { ...p.manaPool, G: 2 } } : p)) as GameState['players'] };
  state = act(state, 'you', { type: 'CAST_CREATURE_FROM_GRAVEYARD_VIA_GRANT', instanceId: discardId });
  must(findOn(state, 'you', discardId) !== undefined, 'Banon: Pray successfully casts the discarded creature from the graveyard');
  must(state.players[0].usedGraveyardCastPermissionThisTurn === true, 'Banon: Pray use is tracked for the once-per-turn limit');

  // A second use this turn should fail.
  const discard2Id = nextInstanceId();
  state = withHand(state, 'you', [card('gran-pulse-ochu', { instanceId: discard2Id })]);
  state = { ...state, pendingDiscard: { sourceInstanceId: banonId, controllerId: 'you', count: 1 } };
  state = act(state, 'you', { type: 'DISCARD_CARD', instanceId: discard2Id });
  const secondPray = applyAction(state, { type: 'CAST_CREATURE_FROM_GRAVEYARD_VIA_GRANT', instanceId: discard2Id }, 'you');
  must(secondPray.ok === false, 'Banon: Pray can only be used once per turn');

  // Attack trigger: may pay {1}, discard then draw. Mutual Adjustment stays
  // OFF here too, so the mana payment itself is actually exercised.
  state = { ...state, players: state.players.map((p) => (p.id === 'you' ? { ...p, manaPool: { ...p.manaPool, C: 1 } } : p)) as GameState['players'] };
  const handCardId = nextInstanceId();
  state = withHand(state, 'you', [card('farseek', { instanceId: handCardId })]);
  state = { ...state, phase: 'declare_attackers', activePlayerId: 'you' };
  state = act(state, 'you', { type: 'DECLARE_ATTACKERS', instanceIds: [banonId] });
  must(state.pendingOptionalPayMana !== null, "Banon: attacking arms the 'may pay {1}' choice");
  const libTopId = state.players[0].zones.library[0]?.instanceId;
  state = act(state, 'you', { type: 'RESOLVE_OPTIONAL_PAY_MANA', accept: true });
  must(getPlayerMana(state, 'you', 'C') === 0, 'Banon: accepting pays the {1} mana cost');
  must(state.pendingDiscard !== null, 'Banon: accepting arms the loot discard step');
  state = act(state, 'you', { type: 'DISCARD_CARD', instanceId: handCardId });
  must(state.players[0].zones.hand.some((c) => c.instanceId === libTopId), 'Banon: the loot actually drew a new card');
}

// ---------------------------------------------------------------------------
// Summon: Esper Valigarmanda - exile instant/sorcery (single-pick approx),
// dynamic lore-counter mana
// ---------------------------------------------------------------------------
{
  let state = freshState();
  const valId = nextInstanceId();
  state = withHand(state, 'you', [card('summon-esper-valigarmanda', { instanceId: valId })]);
  state = withGraveyard(state, 'you', [card('farseek')]);
  state = act(state, 'you', { type: 'CAST_CARD', instanceId: valId });
  must(state.pendingGraveyardExile !== null && state.pendingGraveyardExile.instantOrSorceryOnly === true, 'Valigarmanda: chapter I arms an instant/sorcery-only graveyard exile');
  const farseekId = state.players[0].zones.graveyard.find((c) => c.defId === 'farseek')!.instanceId;
  state = act(state, 'you', { type: 'RESOLVE_GRAVEYARD_EXILE', instanceId: farseekId });
  must(state.players[0].zones.exile.some((c) => c.instanceId === farseekId), 'Valigarmanda: the exile actually happens');

  // Advance to chapter II (lore counter 2) and check dynamic mana.
  state = act(state, 'you', { type: 'ADJUST_COUNTER', instanceId: valId, label: 'lore', delta: 1 });
  const valCard = findOn(state, 'you', valId)!;
  must(counterAmount(valCard, 'lore') === 2, 'sanity: lore counter now at 2 (chapter II)');

  const r = resolveCardEffects(state, 'you', [{ type: 'addManaEqualToOwnLoreCounter', color: 'R' }], valId);
  must(r.state.players.find((p) => p.id === 'you')!.manaPool.R === 2, 'Valigarmanda: adds R mana equal to its own lore counter count (2)');
}

// ---------------------------------------------------------------------------
// Sun Titan: optional reanimate (any permanent, mv<=3) on enter AND attack
// ---------------------------------------------------------------------------
{
  let state = freshState();
  const titanId = nextInstanceId();
  state = withGraveyard(state, 'you', [card('plains')]);
  state = withHand(state, 'you', [card('sun-titan', { instanceId: titanId })]);
  state = act(state, 'you', { type: 'CAST_CARD', instanceId: titanId });
  must(state.pendingReanimate !== null && state.pendingReanimate.effect.anyPermanentInsteadOfCreature === true, 'Sun Titan: ETB arms an optional any-permanent reanimate');
  const plainsId = state.players[0].zones.graveyard.find((c) => c.defId === 'plains')!.instanceId;
  state = act(state, 'you', { type: 'RESOLVE_REANIMATE', instanceId: plainsId });
  must(findOn(state, 'you', plainsId) !== undefined, 'Sun Titan: reanimates a LAND (not just a creature) from the graveyard');

  // Decline when attacking with nothing else to reanimate.
  state = act(state, 'you', { type: 'DECLARE_ATTACKERS', instanceIds: [titanId] });
  must(state.pendingReanimate === null, 'Sun Titan: attacking with an empty graveyard does not arm a reanimate');
}

// ---------------------------------------------------------------------------
// Umaro: choose-one-at-random (reuse), discardHandThenDraw, buff+keyword, damage
// ---------------------------------------------------------------------------
{
  // Directly test each of Umaro's 3 modes via resolveCardEffects, bypassing randomness.
  let state = freshState();
  const umaroId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('umaro-raging-yeti', { instanceId: umaroId })]);
  const otherId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('gran-pulse-ochu', { instanceId: otherId })]);

  let r = resolveCardEffects(state, 'you', [{ type: 'buffOtherCreaturesYouControl', power: 3, toughness: 0, grantKeyword: 'trample' }], umaroId);
  const other = r.state.players[0].zones.battlefield.find((c: CardInstance) => c.instanceId === otherId)!;
  must(!!other.temporaryBuff && other.temporaryBuff.power === 3, 'Umaro mode 1: buffs OTHER creatures +3/+0');
  must(!!other.temporaryKeywords?.includes('trample'), 'Umaro mode 1: grants trample to other creatures');

  state = withHand(state, 'you', [card('farseek'), card('farseek')]);
  r = resolveCardEffects(state, 'you', [{ type: 'discardHandThenDraw', drawCount: 4 }], umaroId);
  must(r.state.players[0].zones.hand.length === Math.min(4, r.state.players[0].zones.library.length + 2), 'Umaro mode 2: discards hand then draws 4');
  must(r.state.players[0].zones.graveyard.length === 2, 'Umaro mode 2: the discarded hand actually lands in the graveyard');

  r = resolveCardEffects(state, 'you', [{ type: 'damageAnyTarget', amount: 5 }], umaroId);
  must(r.state.pendingTarget !== null && r.state.pendingTarget.effect.type === 'damageAnyTarget', 'Umaro mode 3: arms a 5-damage any-target pick');
}

// ---------------------------------------------------------------------------
// Yuffie: Ninjutsu + permanent artifact control gain + chained equip-attach
// ---------------------------------------------------------------------------
{
  let state = freshState();
  const attackerId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('gran-pulse-ochu', { instanceId: attackerId, summoningSick: false })]);
  state = { ...state, activePlayerId: 'you', phase: 'declare_attackers' };
  state = act(state, 'you', { type: 'DECLARE_ATTACKERS', instanceIds: [attackerId] });
  state = { ...state, phase: 'declare_blockers' };
  state = act(state, 'opp', { type: 'DECLARE_BLOCKERS', assignments: [] });
  must(state.phase === 'combat_damage', 'sanity: declaring zero blocks jumps straight to combat_damage');

  const yuffieId = nextInstanceId();
  state = withHand(state, 'you', [card('yuffie-materia-hunter', { instanceId: yuffieId })]);
  state = { ...state, players: state.players.map((p) => (p.id === 'you' ? { ...p, manaPool: { ...p.manaPool, R: 1, C: 1 } } : p)) as GameState['players'] };
  state = act(state, 'you', { type: 'ACTIVATE_NINJUTSU', instanceId: yuffieId, returnInstanceId: attackerId });
  must(findOn(state, 'you', attackerId) === undefined, 'Yuffie: the returned attacker leaves the battlefield');
  must(state.players[0].zones.hand.some((c) => c.instanceId === attackerId), 'Yuffie: the returned attacker goes back to hand');
  const yuffieOnField = findOn(state, 'you', yuffieId)!;
  must(yuffieOnField.tapped === true && yuffieOnField.summoningSick === false, 'Yuffie: enters tapped, no summoning sickness');
  must(state.declaredAttackers.includes(yuffieId) && !state.declaredAttackers.includes(attackerId), "Yuffie: replaces the returned creature as an attacker");

  must(state.pendingTarget !== null && state.pendingTarget.effect.type === 'gainControlOfTargetNoncreatureArtifactPermanent', "Yuffie: ETB arms the artifact control-gain target");
  const artifactId = nextInstanceId();
  state = withBattlefield(state, 'opp', [card('skullclamp', { instanceId: artifactId, ownerId: 'opp' })]);
  state = act(state, 'you', { type: 'CHOOSE_TARGET', targetInstanceId: artifactId });
  must(findOn(state, 'you', artifactId) !== undefined, "Yuffie: gains control of the opponent's noncreature artifact");

  // No Equipment to attach -> chain should NOT re-arm pendingTarget.
  must(state.pendingTarget === null, 'Yuffie: with no Equipment to attach, the chained "may attach" step does not arm');

  // Now redo with an Equipment present to confirm the chained attach step.
  let state2 = freshState();
  const attacker2 = nextInstanceId();
  state2 = withBattlefield(state2, 'you', [card('gran-pulse-ochu', { instanceId: attacker2, summoningSick: false })]);
  state2 = { ...state2, activePlayerId: 'you', phase: 'declare_attackers' };
  state2 = act(state2, 'you', { type: 'DECLARE_ATTACKERS', instanceIds: [attacker2] });
  state2 = { ...state2, phase: 'declare_blockers' };
  state2 = act(state2, 'opp', { type: 'DECLARE_BLOCKERS', assignments: [] });
  const yuffie2 = nextInstanceId();
  state2 = withHand(state2, 'you', [card('yuffie-materia-hunter', { instanceId: yuffie2 })]);
  state2 = { ...state2, players: state2.players.map((p) => (p.id === 'you' ? { ...p, manaPool: { ...p.manaPool, R: 1, C: 1 } } : p)) as GameState['players'] };
  state2 = act(state2, 'you', { type: 'ACTIVATE_NINJUTSU', instanceId: yuffie2, returnInstanceId: attacker2 });
  const skullclampId = nextInstanceId();
  state2 = withBattlefield(state2, 'you', [card('skullclamp', { instanceId: skullclampId })]);
  const theirArtifactId = nextInstanceId();
  state2 = withBattlefield(state2, 'opp', [card('skullclamp', { instanceId: theirArtifactId, ownerId: 'opp' })]);
  state2 = act(state2, 'you', { type: 'CHOOSE_TARGET', targetInstanceId: theirArtifactId });
  must(
    state2.pendingTarget !== null && state2.pendingTarget.effect.type === 'mayAttachTargetControlledEquipmentToSelf',
    'Yuffie: with an Equipment present, the chained "may attach" step DOES arm'
  );
  state2 = act(state2, 'you', { type: 'CHOOSE_TARGET', targetInstanceId: skullclampId });
  const equippedSkullclamp = state2.players[0].zones.battlefield.find((c) => c.instanceId === skullclampId)!;
  must(equippedSkullclamp.attachedToInstanceId === yuffie2, 'Yuffie: the chosen Equipment is attached to Yuffie herself');
}

// ---------------------------------------------------------------------------
// Ultimate Magic Holy / Meteor / Lifestream's Blessing: Foretell + bonuses
// ---------------------------------------------------------------------------
{
  let state = freshState();
  const holyId = nextInstanceId();
  state = withHand(state, 'you', [card('ultimate-magic-holy', { instanceId: holyId })]);
  state = { ...state, players: state.players.map((p) => (p.id === 'you' ? { ...p, manaPool: { ...p.manaPool, C: 2 } } : p)) as GameState['players'] };
  state = act(state, 'you', { type: 'FORETELL_CARD', instanceId: holyId });
  must(state.players[0].zones.exile.some((c) => c.instanceId === holyId && c.faceDown === true), 'Foretell: exiles the card face down');
  must(getPlayerMana(state, 'you', 'C') === 0, 'Foretell: pays the fixed {2} exile cost');
  const grant = state.exilePlayGrants.find((g) => g.instanceId === holyId);
  must(!!grant && grant.overrideCostLabel === '{2}{W}', 'Foretell: grants a persistent cast permission at the foretell cost');

  const creatureId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('gran-pulse-ochu', { instanceId: creatureId })]);
  state = { ...state, players: state.players.map((p) => (p.id === 'you' ? { ...p, manaPool: { ...p.manaPool, W: 1, C: 1 } } : p)) as GameState['players'] };
  state = act(state, 'you', { type: 'CAST_FROM_EXILE', instanceId: holyId });
  const creature = findOn(state, 'you', creatureId)!;
  must(!!creature.temporaryKeywords?.includes('indestructible'), 'Ultimate Magic Holy: grants indestructible on cast');
  must(!state.players[0].zones.exile.some((c) => c.instanceId === holyId), 'Foretell: the card actually left exile when cast');
}

{
  let state = freshState();
  const meteorId = nextInstanceId();
  state = withHand(state, 'you', [card('ultimate-magic-meteor', { instanceId: meteorId })]);
  state = { ...state, players: state.players.map((p) => (p.id === 'you' ? { ...p, manaPool: { ...p.manaPool, C: 2 } } : p)) as GameState['players'] };
  state = act(state, 'you', { type: 'FORETELL_CARD', instanceId: meteorId });
  state = { ...state, players: state.players.map((p) => (p.id === 'you' ? { ...p, manaPool: { ...p.manaPool, R: 1, C: 5 } } : p)) as GameState['players'] };
  const theirLand = nextInstanceId();
  state = withBattlefield(state, 'opp', [card('plains', { instanceId: theirLand, ownerId: 'opp' })]);
  state = act(state, 'you', { type: 'CAST_FROM_EXILE', instanceId: meteorId });
  must(
    state.pendingTarget !== null && state.pendingTarget.effect.type === 'destroyTarget' && state.pendingTarget.effect.targetFilter === 'opponentArtifactOrLand',
    'Ultimate Magic Meteor: foretold cast arms the opponent-artifact-or-land destroy'
  );
  state = act(state, 'you', { type: 'CHOOSE_TARGET', targetInstanceId: theirLand });
  must(state.players[1].zones.battlefield.every((c) => c.instanceId !== theirLand), "Ultimate Magic Meteor: destroys the opponent's chosen land");
}

{
  let state = freshState();
  const bigId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('summon-esper-valigarmanda', { instanceId: bigId })]); // power 3
  const blessingId = nextInstanceId();
  state = withHand(state, 'you', [card('lifestream-s-blessing', { instanceId: blessingId })]);
  state = { ...state, players: state.players.map((p) => (p.id === 'you' ? { ...p, manaPool: { ...p.manaPool, G: 2, C: 4 } } : p)) as GameState['players'] };
  const beforeLife = state.players[0].life;
  const beforeHand = state.players[0].zones.hand.length - 1;
  state = act(state, 'you', { type: 'CAST_CARD', instanceId: blessingId });
  must(state.players[0].zones.hand.length - beforeHand === 3, "Lifestream's Blessing: draws X = greatest controlled power (3)");
  must(state.players[0].life === beforeLife, "Lifestream's Blessing: no life gain on a normal (non-exile) cast");
}

// ---------------------------------------------------------------------------
// Skullclamp: equipped creature +1/-1, draws 2 when the equipped creature dies
// ---------------------------------------------------------------------------
{
  let state = freshState();
  const clampId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('skullclamp', { instanceId: clampId })]);
  const bearId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('gran-pulse-ochu', { instanceId: bearId, attachedToInstanceId: clampId })]);
  const beforeHand = state.players[0].zones.hand.length;
  const killed = moveCreaturesToGraveyardAndTrigger(state, [bearId], 'is destroyed');
  state = { ...killed.state, log: [...killed.state.log, ...killed.logLines] };
  must(state.players[0].zones.hand.length - beforeHand === 2, 'Skullclamp: draws 2 cards when the equipped creature dies');
  const clampAfter = findOn(state, 'you', clampId);
  must(clampAfter !== undefined && clampAfter.attachedToInstanceId === undefined, 'Skullclamp: itself survives, unattached, after the equipped creature dies');
}

// ---------------------------------------------------------------------------
// Sword of the Animist / Summoning Materia: reused equip hooks + new equip
// mana-ability grant
// ---------------------------------------------------------------------------
{
  let state = freshState();
  const materiaId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('summoning-materia', { instanceId: materiaId })]);
  const bearId = nextInstanceId();
  state = withBattlefield(state, 'you', [card('gran-pulse-ochu', { instanceId: bearId, attachedToInstanceId: materiaId, summoningSick: false })]);
  state = act(state, 'you', { type: 'TOGGLE_TAP', instanceId: bearId });
  must(getPlayerMana(state, 'you', 'G') === 1, "Summoning Materia: equipped creature gains the granted '{T}: Add G' ability");
}

console.log('ALL BATCH 13 TESTS PASSED');
