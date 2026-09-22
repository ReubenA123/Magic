// ============================================================================
// engine/combat.ts
// ============================================================================

import { CardDefinition, CardInstance, GameState, WardCost } from '../types';
import { getCardDefinition, frontFaceDefId } from '../data/cards';
import { getOpponent, getPlayer, updatePlayer, detachEverythingFrom, nextInstanceId } from './state';
import { hasKeyword, hasKeywordEffective } from './keywords';

function countLands(state: GameState, controllerId: string): number {
  const player = state.players.find((p) => p.id === controllerId);
  if (!player) return 0;
  return player.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'land').length;
}

/** Whether def's landCountBuff (see types.ts) is currently active for this controller. */
function hasActiveLandCountBuff(def: CardDefinition, state: GameState, controllerId: string): boolean {
  return !!def.landCountBuff && countLands(state, controllerId) >= def.landCountBuff.minLands;
}

/** Whether any Aura/Equipment attached to `instanceId` sets its base power
 * and toughness to the controller's life total (e.g. Aettir and Priwen) -
 * checked before counters/buffs are layered on top, same as real Magic's
 * layer system (a "set base P/T" effect applies earlier than +1/+1 counters). */
function lifeBasedBaseStat(state: GameState, controllerId: string, instanceId: string): number | null {
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return null;
  const hasLifeBasedEquipment = controller.zones.battlefield.some(
    (c) => c.attachedToInstanceId === instanceId && getCardDefinition(c.defId).setsBasePowerToughnessToControllerLife
  );
  return hasLifeBasedEquipment ? controller.life : null;
}

/** Base power override for CardDefinition.basePowerEqualsControlledCreatureCount
 * (Snow Villiers) - counts every creature on the controller's battlefield,
 * including this one itself (same as real Magic's "creatures you control"). */
function creatureCountBaseStat(state: GameState, controllerId: string, def: CardDefinition): number | null {
  if (!def.basePowerEqualsControlledCreatureCount) return null;
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return null;
  return controller.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length;
}

/** Whether `instanceId` currently has `keyword` from an attached Equipment's
 * "During your turn, equipped creature has KEYWORD" grant (e.g. Dragoon's
 * Lance's flying) - true only while it's this creature's controller's own
 * turn. See CardDefinition.equipGrantsKeywordDuringOwnTurn. */
export function hasEquipGrantedKeywordDuringOwnTurn(state: GameState, controllerId: string, instanceId: string, keyword: string): boolean {
  if (state.activePlayerId !== controllerId) return false;
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return false;
  return controller.zones.battlefield.some((c) => c.attachedToInstanceId === instanceId && getCardDefinition(c.defId).equipGrantsKeywordDuringOwnTurn === keyword);
}

/** Whether `def` currently has `keyword` from its own "During your turn, [this
 * creature] has KEYWORD" grant (Freya Crescent's Jump) - the self-only
 * counterpart to hasEquipGrantedKeywordDuringOwnTurn. */
export function hasSelfGrantedKeywordDuringOwnTurn(state: GameState, controllerId: string, def: CardDefinition, keyword: string): boolean {
  if (state.activePlayerId !== controllerId || !def.grantsSelfKeywordDuringOwnTurn) return false;
  const granted = def.grantsSelfKeywordDuringOwnTurn;
  return Array.isArray(granted) ? granted.includes(keyword) : granted === keyword;
}

/** Whether `instanceId` currently has `keyword` from an attached Equipment's
 * unconditional "Equipped creature has KEYWORD" grant (Genji Glove's double
 * strike) - the always-on counterpart to hasEquipGrantedKeywordDuringOwnTurn. */
export function hasEquipGrantedKeyword(state: GameState, controllerId: string, instanceId: string, keyword: string): boolean {
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return false;
  return controller.zones.battlefield.some((c) => {
    const granted = getCardDefinition(c.defId).equipGrantsKeyword;
    if (!granted || c.attachedToInstanceId !== instanceId) return false;
    return Array.isArray(granted) ? granted.includes(keyword) : granted === keyword;
  });
}

/** Whether `instance` (controlled by `controllerId`, whose own definition is
 * `def`) currently has `keyword` via ANY controlled permanent's board-wide
 * keyword grant - checks two independent sources:
 *  - CardDefinition.grantsControlledGroupKeywordsDuringOwnTurn (Yuna, Hope
 *    of Spira's "Yuna and enchantment creatures you control have trample,
 *    lifelink..."), only during that controller's own turn.
 *  - CardDefinition.staticAnthemForControlledSubtype.grantKeywords (Balthier
 *    and Fran's "Vehicles you control...have vigilance and reach", Ardyn,
 *    the Usurper's "Demons you control have menace, lifelink, and haste"),
 *    ALWAYS on, same subtype-match rule as that field's power/toughness
 *    half (engine/combat.ts: anthemBuffBonus) - unlike the turn-gated
 *    source above, this one has no "includeSelf" option since every
 *    existing anthem card is careful to exclude itself via
 *    CardDefinition.excludeSelfKeywords instead.
 * See engine/keywords.ts's header for why both stay a plain substring
 * check on `subtype`, same as every other subtype filter in this engine. */
export function hasBoardGrantedKeyword(state: GameState, controllerId: string, instance: CardInstance, def: CardDefinition, keyword: string): boolean {
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return false;
  const hasSubtype = (subtype: string) =>
    !!def.subtype?.toLowerCase().includes(subtype.toLowerCase()) || !!instance.grantedSubtypes?.some((s) => s.toLowerCase() === subtype.toLowerCase());
  const viaStaticAnthem = controller.zones.battlefield.some((c) => {
    const anthem = getCardDefinition(c.defId).staticAnthemForControlledSubtype;
    return !!anthem?.grantKeywords?.includes(keyword) && hasSubtype(anthem.subtype);
  });
  if (viaStaticAnthem) return true;
  if (state.activePlayerId !== controllerId) return false;
  return controller.zones.battlefield.some((c) => {
    const grant = getCardDefinition(c.defId).grantsControlledGroupKeywordsDuringOwnTurn;
    if (!grant?.keywords?.includes(keyword)) return false;
    if (c.instanceId === instance.instanceId) return grant.includeSelf;
    return !!grant.subtypeMatch && def.type === 'creature' && hasSubtype(grant.subtypeMatch);
  });
}

/** The Ward cost currently protecting `instance` (controlled by
 * `ownerId`), if any - checked in this order: the permanent's own printed
 * wardCost, an attached Equipment's equipGrantsWard, then any controlled
 * permanent's grantsControlledGroupKeywordsDuringOwnTurn.ward (during the
 * owner's own turn only, same scoping as hasBoardGrantedKeyword). Returns
 * null if nothing currently grants Ward. See engine/actions.ts:
 * chooseTarget/resolveWardPayment. */
export function effectiveWardCost(state: GameState, ownerId: string, instance: CardInstance, def: CardDefinition): WardCost | null {
  if (def.wardCost) return def.wardCost;
  const owner = state.players.find((p) => p.id === ownerId);
  if (!owner) return null;
  const equip = owner.zones.battlefield.find((c) => c.attachedToInstanceId === instance.instanceId && getCardDefinition(c.defId).equipGrantsWard);
  if (equip) return getCardDefinition(equip.defId).equipGrantsWard!;
  if (state.activePlayerId === ownerId) {
    for (const c of owner.zones.battlefield) {
      const grant = getCardDefinition(c.defId).grantsControlledGroupKeywordsDuringOwnTurn;
      if (!grant?.ward) continue;
      if (c.instanceId === instance.instanceId && grant.includeSelf) return grant.ward;
      if (grant.subtypeMatch && def.type === 'creature' && def.subtype?.toLowerCase().includes(grant.subtypeMatch.toLowerCase())) return grant.ward;
    }
  }
  return null;
}

/** Adds `amount` life to playerId AND tracks it in
 * PlayerState.lifeGainedThisTurn (Hope Estheim) - the one place every
 * AUTOMATIC life-gain source should go through (lifelink combat damage,
 * onAnyDeathDrain, a gainLife effect, ...). Deliberately NOT used by the
 * manual ADJUST_LIFE action, same "manual changes don't feed automatic
 * triggers" convention as onGainLifeTrigger. */
export function addLife(state: GameState, playerId: string, amount: number): GameState {
  return updatePlayer(state, playerId, (p) => ({ ...p, life: p.life + amount, lifeGainedThisTurn: p.lifeGainedThisTurn + amount }));
}

/** Mirror image of addLife above - the single funnel every AUTOMATIC life-LOSS
 * source should go through, so onOpponentLifeLossDuringYourTurn watchers
 * (Kefka, Ruler of Ruin) see it. Fires per-event (not summed over the turn,
 * unlike lifeGainedThisTurn), only for a watcher whose controller is the
 * currently active player and whose OPPONENT is the one losing life -
 * "during your turn" is what the currently-active-player check captures. */
export function loseLife(state: GameState, playerId: string, amount: number): GameState {
  let next = updatePlayer(state, playerId, (p) => ({ ...p, life: p.life - amount }));
  if (amount <= 0) return next;
  const activePlayer = next.players.find((p) => p.id === next.activePlayerId);
  if (!activePlayer || activePlayer.id === playerId) return next;
  const watchers = activePlayer.zones.battlefield.filter((c) => getCardDefinition(c.defId).onOpponentLifeLossDuringYourTurn);
  for (const watcher of watchers) {
    const watcherDef = getCardDefinition(watcher.defId);
    const drawn = getPlayer(next, activePlayer.id).zones.library.slice(0, amount);
    next = updatePlayer(next, activePlayer.id, (p) => ({
      ...p,
      zones: { ...p.zones, library: p.zones.library.slice(drawn.length), hand: [...p.zones.hand, ...drawn] },
    }));
    next = { ...next, log: [...next.log, `${watcherDef.name} triggers: ${activePlayer.name} draws ${drawn.length} card(s).`] };
  }
  return next;
}

/** Whether `controllerId` controls a permanent whose doublesSubtypeDamage
 * (see types.ts) matches `sourceDef`'s own subtype - e.g. Trance Kuja, Fate
 * Defied's Flare Star doubling all Wizard damage. Returns the multiplier to
 * apply (1 or 2) so call sites can just multiply by it, rather than a
 * boolean callers would have to branch on themselves. */
export function damageMultiplierFor(state: GameState, controllerId: string, sourceDef: CardDefinition): number {
  if (!sourceDef.subtype) return 1;
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return 1;
  const doubles = controller.zones.battlefield.some((c) => {
    const d = getCardDefinition(c.defId);
    return !!d.doublesSubtypeDamage && sourceDef.subtype!.toLowerCase().includes(d.doublesSubtypeDamage.toLowerCase());
  });
  return doubles ? 2 : 1;
}

/** Whether def's controlledTypeCountBuff (see types.ts) is currently active
 * for this controller - the generalized, any-CardType counterpart to
 * hasActiveLandCountBuff. */
function hasActiveControlledTypeCountBuff(def: CardDefinition, state: GameState, controllerId: string): boolean {
  if (!def.controlledTypeCountBuff) return false;
  const player = state.players.find((p) => p.id === controllerId);
  if (!player) return false;
  const count = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === def.controlledTypeCountBuff!.type).length;
  return count >= def.controlledTypeCountBuff.minCount;
}

/** Sum of +X/+Y from any Equipment attached to `instanceId` that carries a
 * static equipBuff (e.g. Coral Sword's "+1/+0"). */
/** Whether `instanceId` currently counts as `subtypeWord` via an attached
 * Equipment's "equipped creature is a [X] in addition to its other types"
 * grant (CardDefinition.equipGrantsSubtype, e.g. Sage's Nouliths granting
 * Cleric) - checked ALONGSIDE the permanent's own printed subtype text
 * wherever a subtype-counting/filtering effect needs to agree with what the
 * card's own type line now shows (see engine/effects.ts: pumpControlledSubtype,
 * engine/combat.ts: applyGainLifeTriggers's subtypeFilter). */
export function hasGrantedSubtype(state: GameState, controllerId: string, instanceId: string, subtypeWord: string): boolean {
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return false;
  const self = controller.zones.battlefield.find((c) => c.instanceId === instanceId);
  // CardInstance.grantedSubtypes (Jenova, Ancient Calamity's "that creature
  // becomes a Mutant in addition to its other types") - a PERMANENT,
  // instance-level grant, unlike equipGrantsSubtype below (comes from an
  // attached Equipment and disappears if it's unattached).
  if (self?.grantedSubtypes?.some((s) => s.toLowerCase() === subtypeWord.toLowerCase())) return true;
  return controller.zones.battlefield.some(
    (c) => c.attachedToInstanceId === instanceId && getCardDefinition(c.defId).equipGrantsSubtype?.toLowerCase() === subtypeWord.toLowerCase()
  );
}

function equipBuffBonus(state: GameState, controllerId: string, instanceId: string): { power: number; toughness: number } {
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return { power: 0, toughness: 0 };
  return controller.zones.battlefield.reduce(
    (acc, c) => {
      if (c.attachedToInstanceId !== instanceId) return acc;
      const cDef = getCardDefinition(c.defId);
      const fixed = cDef.equipBuff ?? { power: 0, toughness: 0 };
      const perCounter = cDef.equipBuffPerCounter;
      const perCounterAmount = perCounter ? (c.counters.find((ctr) => ctr.label === perCounter.counterLabel)?.amount ?? 0) : 0;
      const perType = cDef.equipBuffPerControlledType;
      const perTypeCount = perType ? controller.zones.battlefield.filter((c2) => getCardDefinition(c2.defId).type === perType.type).length : 0;
      return {
        power: acc.power + fixed.power + (perCounter ? perCounter.power * perCounterAmount : 0) + (perType ? perType.power * perTypeCount : 0),
        toughness: acc.toughness + fixed.toughness + (perCounter ? perCounter.toughness * perCounterAmount : 0) + (perType ? perType.toughness * perTypeCount : 0),
      };
    },
    { power: 0, toughness: 0 }
  );
}

/** Per-attachment breakdown of what each Equipment/Aura attached to
 * `instanceId` is individually contributing right now (static +X/+Y,
 * unconditional or during-your-turn granted keywords, a granted subtype) -
 * the same underlying fields equipBuffBonus/hasEquipGrantedKeyword/
 * hasEquipGrantedKeywordDuringOwnTurn already read, just split out per
 * source instead of summed/flattened into a single yes-or-no, so the UI can
 * show "which card is giving which" (components/CardActionsPanel.tsx).
 * Omits an attachment that isn't currently contributing anything (e.g. an
 * Aura that only taps its target on attach, nothing ongoing). */
export interface EquipmentContribution {
  sourceInstanceId: string;
  sourceName: string;
  power: number;
  toughness: number;
  keywords: string[];
  subtype?: string;
}

export function equipmentContributions(state: GameState, controllerId: string, instanceId: string): EquipmentContribution[] {
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return [];
  const result: EquipmentContribution[] = [];
  for (const c of controller.zones.battlefield) {
    if (c.attachedToInstanceId !== instanceId) continue;
    const cDef = getCardDefinition(c.defId);
    const fixed = cDef.equipBuff ?? { power: 0, toughness: 0 };
    const perCounter = cDef.equipBuffPerCounter;
    const perCounterAmount = perCounter ? (c.counters.find((ctr) => ctr.label === perCounter.counterLabel)?.amount ?? 0) : 0;
    const perType = cDef.equipBuffPerControlledType;
    const perTypeCount = perType ? controller.zones.battlefield.filter((c2) => getCardDefinition(c2.defId).type === perType.type).length : 0;
    const power = fixed.power + (perCounter ? perCounter.power * perCounterAmount : 0) + (perType ? perType.power * perTypeCount : 0);
    const toughness = fixed.toughness + (perCounter ? perCounter.toughness * perCounterAmount : 0) + (perType ? perType.toughness * perTypeCount : 0);
    const keywords: string[] = [];
    if (cDef.equipGrantsKeyword) keywords.push(...(Array.isArray(cDef.equipGrantsKeyword) ? cDef.equipGrantsKeyword : [cDef.equipGrantsKeyword]));
    if (cDef.equipGrantsKeywordDuringOwnTurn && state.activePlayerId === controllerId) keywords.push(cDef.equipGrantsKeywordDuringOwnTurn);
    if (power === 0 && toughness === 0 && keywords.length === 0 && !cDef.equipGrantsSubtype) continue;
    result.push({ sourceInstanceId: c.instanceId, sourceName: cDef.name, power, toughness, keywords, subtype: cDef.equipGrantsSubtype });
  }
  return result;
}

/** Sum of +X/+Y from any OTHER permanent controllerId controls with a
 * static "[subtype]s you control get +X/+Y" anthem (Balthier and Fran's
 * "Vehicles you control get +1/+1") matching `def`'s own subtype. Unlike
 * equipBuffBonus (attachment-based), this scans the controller's WHOLE
 * battlefield for a matching source. */
function anthemBuffBonus(state: GameState, controllerId: string, def: CardDefinition): { power: number; toughness: number } {
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller || !def.subtype) return { power: 0, toughness: 0 };
  return controller.zones.battlefield.reduce(
    (acc, c) => {
      const anthem = getCardDefinition(c.defId).staticAnthemForControlledSubtype;
      if (!anthem || !def.subtype!.toLowerCase().includes(anthem.subtype.toLowerCase())) return acc;
      return { power: acc.power + anthem.power, toughness: acc.toughness + anthem.toughness };
    },
    { power: 0, toughness: 0 }
  );
}

export function effectivePower(def: CardDefinition, instance: CardInstance, state: GameState, controllerId: string): number {
  const base =
    instance.temporaryBaseStats?.power ??
    lifeBasedBaseStat(state, controllerId, instance.instanceId) ??
    creatureCountBaseStat(state, controllerId, def) ??
    (def.power ?? 0);
  const plus = instance.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
  const minus = instance.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
  const buff = hasActiveLandCountBuff(def, state, controllerId) ? def.landCountBuff!.power : 0;
  const typeBuff = hasActiveControlledTypeCountBuff(def, state, controllerId) ? def.controlledTypeCountBuff!.power : 0;
  const temp = instance.temporaryBuff?.power ?? 0;
  const equip = equipBuffBonus(state, controllerId, instance.instanceId).power;
  const anthem = anthemBuffBonus(state, controllerId, def).power;
  return base + plus - minus + buff + typeBuff + temp + equip + anthem;
}

export function effectiveToughness(def: CardDefinition, instance: CardInstance, state: GameState, controllerId: string): number {
  const base = instance.temporaryBaseStats?.toughness ?? lifeBasedBaseStat(state, controllerId, instance.instanceId) ?? (def.toughness ?? 0);
  const plus = instance.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
  const minus = instance.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
  const buff = hasActiveLandCountBuff(def, state, controllerId) ? def.landCountBuff!.toughness : 0;
  const typeBuff = hasActiveControlledTypeCountBuff(def, state, controllerId) ? def.controlledTypeCountBuff!.toughness : 0;
  const temp = instance.temporaryBuff?.toughness ?? 0;
  const equip = equipBuffBonus(state, controllerId, instance.instanceId).toughness;
  const anthem = anthemBuffBonus(state, controllerId, def).toughness;
  return base + plus - minus + buff + typeBuff + temp + equip + anthem;
}

/** Is `card` (controlled by `ownerId`) a legal choice for `pendingTarget`
 * right now? Pure and state-only (no visibility/whose-turn-is-it gating -
 * that's the caller's job) so it's usable both by the human-facing UI
 * (client/src/components/GameBoard.tsx, gated there by pendingTargetForYou)
 * and by the local VS AI's own targeting decisions (useLocalGame.ts) - both
 * need to agree on exactly the same legality rules, or the AI could end up
 * trying to CHOOSE_TARGET something the engine (and a human) would never
 * have been offered, silently failing and leaving the pending target banner
 * stuck forever.
 *
 * tapAndStun and debuffTargetByGraveyard only ever target the opponent's
 * permanents; destroyTarget (e.g. Airship Crash), pumpTarget (e.g.
 * Blitzball Shot), and putCounterOnTarget (e.g. Cloudbound Moogle) name no
 * controller restriction at all, so either player's permanents are fair
 * game there. */
export function isLegalPendingTarget(state: GameState, pendingTarget: NonNullable<GameState['pendingTarget']>, card: CardInstance, ownerId: string): boolean {
  const def = getCardDefinition(card.defId);
  // Hexproof - never a legal target for an OPPONENT's spell/ability,
  // regardless of what the specific effect below would otherwise allow.
  // Self-targeting is unaffected (real hexproof only stops opponents). See
  // engine/actions.ts: chooseTarget for the matching server-side rejection.
  if (ownerId !== pendingTarget.controllerId && (hasKeywordEffective(def, card, 'hexproof') || hasBoardGrantedKeyword(state, ownerId, card, def, 'hexproof'))) {
    return false;
  }
  const effect = pendingTarget.effect;
  if (effect.type === 'tapAndStun') {
    if (ownerId === pendingTarget.controllerId) return false;
    return effect.targetType === 'artifactOrCreature' ? def.type === 'artifact' || def.type === 'creature' : def.type === effect.targetType;
  }
  if (effect.type === 'untapTargetAttacker') {
    return state.declaredAttackers.includes(card.instanceId);
  }
  if (effect.type === 'tapStunAndGainLifeForNonbasicLands') {
    if (ownerId === pendingTarget.controllerId) return false;
    return def.type !== 'land';
  }
  if (effect.type === 'chooseCreatureDebuffOthersAndWatchLeave') {
    if (ownerId === pendingTarget.controllerId) return false;
    return def.type === 'creature';
  }
  if (effect.type === 'grantTemporaryBaseStatsAndDeathReturn') {
    return def.type === 'creature' && ownerId === pendingTarget.controllerId;
  }
  if (effect.type === 'pumpTarget') {
    return def.type === 'creature' && (!effect.restrictToOwnCreature || ownerId === pendingTarget.controllerId);
  }
  if (effect.type === 'grantKeywordsToTargetPermanent') {
    return true;
  }
  if (effect.type === 'gainControlOfTargetCreature') {
    if (def.type !== 'creature') return false;
    return !effect.opponentControlledOnly || ownerId !== pendingTarget.controllerId;
  }
  if (effect.type === 'giveControlOfAnotherOwnPermanentToOpponent') {
    return ownerId === pendingTarget.controllerId && card.instanceId !== pendingTarget.sourceInstanceId;
  }
  if (effect.type === 'gainControlOfTargetEquipmentAndAttach') {
    if (!pendingTarget.firstInstanceId) {
      // First pick: "target creature you control".
      return def.type === 'creature' && ownerId === pendingTarget.controllerId;
    }
    // Second pick: "target Equipment" (either player's).
    return !!def.subtype?.toLowerCase().includes('equipment');
  }
  if (effect.type === 'putCounterOnTarget') {
    return def.type === 'creature';
  }
  if (effect.type === 'debuffTargetByGraveyard') {
    if (ownerId === pendingTarget.controllerId) return false;
    return def.type === 'creature';
  }
  if (effect.type === 'selfFightTarget') {
    return def.type === 'creature' && card.instanceId !== pendingTarget.sourceInstanceId;
  }
  if (effect.type === 'chooseCreaturesFight') {
    if (def.type !== 'creature') return false;
    return pendingTarget.firstInstanceId ? ownerId !== pendingTarget.controllerId : ownerId === pendingTarget.controllerId;
  }
  if (effect.type === 'modifySagaLoreCounter') {
    return !!def.saga && ownerId === pendingTarget.controllerId;
  }
  if (effect.type === 'tapTarget') {
    return effect.targetFilter === 'nonlandPermanent' ? def.type !== 'land' : def.type === 'creature';
  }
  if (effect.type === 'putCounterOnUpToOneOwnCreature') {
    return def.type === 'creature' && ownerId === pendingTarget.controllerId;
  }
  if (effect.type === 'attachSelfToTarget') {
    const matchesType = effect.targetTypeFilter === 'artifactOrCreature' ? def.type === 'artifact' || def.type === 'creature' : def.type === 'creature';
    return matchesType && (effect.allowAnyController || ownerId === pendingTarget.controllerId);
  }
  if (effect.type === 'createTokenCopyOfTarget') {
    return def.type === 'artifact' || def.type === 'creature' || def.type === 'land';
  }
  if (effect.type === 'destroyOpponentCreature') {
    if (ownerId === pendingTarget.controllerId) return false;
    return def.type === 'creature';
  }
  if (effect.type === 'bounceTarget') {
    return effect.targetFilter === 'creature' ? def.type === 'creature' : def.type !== 'land';
  }
  if (effect.type === 'bounceUpToOneOtherNonlandPermanent') {
    return def.type !== 'land' && card.instanceId !== pendingTarget.sourceInstanceId;
  }
  if (effect.type === 'putCounterOnUpToOneOtherCreatureEqualToOwnPower') {
    return def.type === 'creature' && card.instanceId !== pendingTarget.sourceInstanceId;
  }
  if (effect.type === 'damageTargetAndControllerByEquipmentCount') {
    return def.type === 'creature';
  }
  if (effect.type === 'pumpAnotherControlledCreature') {
    return def.type === 'creature' && ownerId === pendingTarget.controllerId && card.instanceId !== pendingTarget.sourceInstanceId;
  }
  if (effect.type === 'damageTargetCreature') {
    return def.type === 'creature';
  }
  if (effect.type === 'sweepDamageFromChosenCreature') {
    return def.type === 'creature' && ownerId === pendingTarget.controllerId;
  }
  const isFlyingCreature = def.type === 'creature' && hasKeyword(def, 'flying');
  return (
    effect.targetFilter === 'anyPermanent' ||
    (effect.targetFilter === 'nonlandPermanent' && def.type !== 'land') ||
    (effect.targetFilter === 'creatureWithMinPower' && def.type === 'creature' && effectivePower(def, card, state, ownerId) >= (effect.minPower ?? 0)) ||
    (effect.targetFilter === 'artifactEnchantmentOrFlyingCreature' && (def.type === 'artifact' || def.type === 'enchantment' || isFlyingCreature)) ||
    (effect.targetFilter === 'artifactOrEnchantment' && (def.type === 'artifact' || def.type === 'enchantment')) ||
    (effect.targetFilter === 'creatureWithDamageMarked' && def.type === 'creature' && card.damageMarked > 0) ||
    (effect.targetFilter === 'land' && def.type === 'land') ||
    (effect.targetFilter === 'creature' && def.type === 'creature')
  );
}

/** True for a real creature, or for a Vehicle (def.crew set) that's
 * currently crewed (instance.crewedUntilEndOfTurn) - see CardDefinition.crew.
 * Every place that previously checked `def.type === 'creature'` for combat
 * legality or death purposes goes through this instead, so a crewed Vehicle
 * can attack, block, and die like any other creature until end of turn. */
export function isEffectivelyCreature(def: CardDefinition, instance: CardInstance): boolean {
  return def.type === 'creature' || (def.crew !== undefined && !!instance.crewedUntilEndOfTurn) || !!instance.temporarilyCreatureUntilEndOfTurn;
}

function findInstance(state: GameState, instanceId: string) {
  for (const player of state.players) {
    const instance = player.zones.battlefield.find((c) => c.instanceId === instanceId);
    if (instance) return { instance, controllerId: player.id };
  }
  return null;
}

function isCommanderAttack(state: GameState, controllerId: string, attackerDefId: string): boolean {
  const controller = state.players.find((p) => p.id === controllerId);
  return !!controller?.commanderDefId && controller.commanderDefId === attackerDefId;
}

function markDamage(state: GameState, instanceId: string, amount: number, isDeathtouch: boolean = false): GameState {
  const found = findInstance(state, instanceId);
  if (!found) return state;
  if (getCardDefinition(found.instance.defId).preventsAllCombatDamage) return state;
  return updatePlayer(state, found.controllerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) =>
        c.instanceId === instanceId ? { ...c, damageMarked: c.damageMarked + amount, tookDeathtouchDamage: c.tookDeathtouchDamage || (isDeathtouch && amount > 0) } : c
      ),
    },
  }));
}

function dealDirectDamageToDefender(
  state: GameState,
  attackerControllerId: string,
  attackerInstanceId: string,
  attackerDefId: string,
  attackerName: string,
  defenderId: string,
  amount: number
): GameState {
  let next = loseLife(state, defenderId, amount);
  if (isCommanderAttack(next, attackerControllerId, attackerDefId)) {
    next = updatePlayer(next, defenderId, (p) => ({ ...p, commanderDamageTaken: p.commanderDamageTaken + amount }));
    next = { ...next, log: [...next.log, `${attackerName} deals ${amount} commander damage.`] };
  }
  // "Whenever this creature deals combat damage to a player, that player
  // loses the game." (Summon: Primal Odin's Zantetsuken chapter) - every
  // path that deals combat damage to a player (unblocked, or trampling over
  // blockers) routes through this one function, so this is the single place
  // to check the granted flag. Only for actual damage, and only if nothing
  // else already ended the game this same instant.
  if (amount > 0 && !next.winnerId) {
    const attackerInstance = findInstance(next, attackerInstanceId)?.instance;
    if (attackerInstance?.grantedCombatDamageToPlayerCausesLoss) {
      const defenderName = getPlayer(next, defenderId).name;
      next = { ...next, winnerId: attackerControllerId, log: [...next.log, `${attackerName} causes ${defenderName} to lose the game.`] };
    }
  }
  return next;
}

function strikesInPass(state: GameState, def: CardDefinition, instance: CardInstance, controllerId: string, pass: 1 | 2): boolean {
  const fs = hasKeyword(def, 'first strike') || hasEquipGrantedKeyword(state, controllerId, instance.instanceId, 'first strike');
  const ds = hasKeyword(def, 'double strike') || hasEquipGrantedKeyword(state, controllerId, instance.instanceId, 'double strike');
  return pass === 1 ? fs || ds : ds || (!fs && !ds);
}

function isPendingDeath(state: GameState, instanceId: string): boolean {
  return state.pendingDeaths.includes(instanceId);
}

/** Checks every permanent playerId controls for an onGainLifeTrigger and
 * applies it. Call this once, right after playerId's life actually goes up
 * (lifelink combat damage, or a gainLife effect - see engine/effects.ts).
 * Deliberately not called for manual life changes under Mutual Adjustment,
 * same as other automatic triggers being bypassed there. */
export function applyGainLifeTriggers(state: GameState, playerId: string): GameState {
  let next = state;
  for (const card of getPlayerBattlefield(next, playerId)) {
    const def = getCardDefinition(card.defId);
    if (!def.onGainLifeTrigger) continue;
    const { counterLabel, counterAmount, subtypeFilter } = def.onGainLifeTrigger;
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          // Unfiltered: only the watcher itself. subtypeFilter set (e.g.
          // Minwu, White Mage's "each Cleric you control"): every controlled
          // creature matching that subtype, which may or may not include
          // the watcher itself depending on its own subtype.
          const matches = subtypeFilter
            ? getCardDefinition(c.defId).type === 'creature' &&
              (!!getCardDefinition(c.defId).subtype?.toLowerCase().includes(subtypeFilter.toLowerCase()) || hasGrantedSubtype(next, playerId, c.instanceId, subtypeFilter))
            : c.instanceId === card.instanceId;
          if (!matches) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
            : [...c.counters, { label: counterLabel, amount: counterAmount }];
          return { ...c, counters };
        }),
      },
    }));
    const targetNote = subtypeFilter ? `each ${subtypeFilter} you control` : def.name;
    next = { ...next, log: [...next.log, `${def.name} triggers: ${targetNote} gets a ${counterLabel} counter.`] };
  }
  return next;
}

function getPlayerBattlefield(state: GameState, playerId: string): CardInstance[] {
  return state.players.find((p) => p.id === playerId)?.zones.battlefield ?? [];
}

function dealDamagePass(state: GameState, pass: 1 | 2): GameState {
  let next = state;

  for (const assignment of next.combatAssignments) {
    const attackerFound = findInstance(next, assignment.attackerInstanceId);
    if (!attackerFound || isPendingDeath(next, attackerFound.instance.instanceId)) continue;
    const attackerDef = getCardDefinition(attackerFound.instance.defId);
    const blockers = assignment.blockerInstanceIds
      .map((id) => findInstance(next, id))
      .filter((b): b is NonNullable<typeof b> => !!b)
      .filter((b) => !isPendingDeath(next, b.instance.instanceId));
    const isDeathtouch = hasKeyword(attackerDef, 'deathtouch');
    const isTrample = hasKeywordEffective(attackerDef, attackerFound.instance, 'trample') || hasBoardGrantedKeyword(next, attackerFound.controllerId, attackerFound.instance, attackerDef, 'trample');
    const isLifelink = hasKeyword(attackerDef, 'lifelink') || hasBoardGrantedKeyword(next, attackerFound.controllerId, attackerFound.instance, attackerDef, 'lifelink');

    if (strikesInPass(next, attackerDef, attackerFound.instance, attackerFound.controllerId, pass)) {
      const power = effectivePower(attackerDef, attackerFound.instance, next, attackerFound.controllerId) * damageMultiplierFor(next, attackerFound.controllerId, attackerDef);

      if (blockers.length === 0) {
        const defender = getOpponent(next, attackerFound.controllerId);
        next = dealDirectDamageToDefender(next, attackerFound.controllerId, attackerFound.instance.instanceId, attackerFound.instance.defId, attackerDef.name, defender.id, power);
        next = { ...next, log: [...next.log, `${attackerDef.name} hits ${defender.name} for ${power}.`] };
        if (isLifelink) {
          next = addLife(next, attackerFound.controllerId, power);
          next = applyGainLifeTriggers(next, attackerFound.controllerId);
        }
        // "Whenever [this] deals combat damage to a player, you may exile
        // it, then return it to the battlefield transformed" (Jecht,
        // Reluctant Guardian) - pauses on a yes/no choice rather than firing
        // automatically like every other trigger in this function.
        if (attackerDef.onCombatDamageToPlayerMayTransform && !next.pendingOptionalTransform) {
          next = { ...next, pendingOptionalTransform: { sourceInstanceId: attackerFound.instance.instanceId, controllerId: attackerFound.controllerId } };
        }
      } else {
        let remaining = power;
        for (const blocker of blockers) {
          if (remaining <= 0) break;
          const blockerDef = getCardDefinition(blocker.instance.defId);
          const toughnessLeft = Math.max(0, effectiveToughness(blockerDef, blocker.instance, next, blocker.controllerId) - blocker.instance.damageMarked);
          const lethal = isDeathtouch ? 1 : toughnessLeft;
          const assigned = isTrample ? Math.min(remaining, Math.max(lethal, 0)) : remaining;
          next = markDamage(next, blocker.instance.instanceId, assigned, isDeathtouch);
          next = { ...next, log: [...next.log, `${attackerDef.name} deals ${assigned} damage to ${blockerDef.name}.`] };
          if (isLifelink) {
            next = addLife(next, attackerFound.controllerId, assigned);
            next = applyGainLifeTriggers(next, attackerFound.controllerId);
          }
          remaining -= assigned;
        }
        if (isTrample && remaining > 0) {
          const defender = getOpponent(next, attackerFound.controllerId);
          next = dealDirectDamageToDefender(next, attackerFound.controllerId, attackerFound.instance.instanceId, attackerFound.instance.defId, attackerDef.name, defender.id, remaining);
          next = { ...next, log: [...next.log, `${attackerDef.name} tramples ${remaining} over to ${defender.name}.`] };
        }
      }
    }

    for (const blocker of blockers) {
      const blockerDef = getCardDefinition(blocker.instance.defId);
      if (!strikesInPass(next, blockerDef, blocker.instance, blocker.controllerId, pass)) continue;
      if (isPendingDeath(next, attackerFound.instance.instanceId)) continue;
      const blockerPower = effectivePower(blockerDef, blocker.instance, next, blocker.controllerId) * damageMultiplierFor(next, blocker.controllerId, blockerDef);
      const blockerHasDeathtouch = hasKeyword(blockerDef, 'deathtouch');
      next = markDamage(next, attackerFound.instance.instanceId, blockerPower, blockerHasDeathtouch);
      next = { ...next, log: [...next.log, `${blockerDef.name} deals ${blockerPower} damage to ${attackerDef.name}.`] };
      if (hasKeyword(blockerDef, 'lifelink') || hasBoardGrantedKeyword(next, blocker.controllerId, blocker.instance, blockerDef, 'lifelink')) {
        next = addLife(next, blocker.controllerId, blockerPower);
        next = applyGainLifeTriggers(next, blocker.controllerId);
      }
    }
  }

  return next;
}

/** Marks lethally-damaged creatures as pending death WITHOUT moving them
 * to the graveyard - they stay visible, greyed out, until the End Combat
 * step ends. See engine/actions.ts: nextPhase -> resolvePendingDeaths. */
function markPendingDeaths(state: GameState): GameState {
  const newlyDead: string[] = [];
  for (const player of state.players) {
    for (const c of player.zones.battlefield) {
      if (state.pendingDeaths.includes(c.instanceId)) continue;
      const def = getCardDefinition(c.defId);
      if (!isEffectivelyCreature(def, c)) continue;
      const isIndestructible = hasKeywordEffective(def, c, 'indestructible');
      const toughness = effectiveToughness(def, c, state, player.id);
      // Deathtouch: any nonzero combat damage from that source is lethal
      // regardless of how much toughness is left, unless indestructible.
      if (!isIndestructible && toughness > 0 && (c.damageMarked >= toughness || c.tookDeathtouchDamage)) newlyDead.push(c.instanceId);
    }
  }
  if (newlyDead.length === 0) return state;

  let next = state;
  for (const id of newlyDead) {
    const found = findInstance(next, id);
    if (found) {
      const def = getCardDefinition(found.instance.defId);
      next = { ...next, log: [...next.log, `${def.name} takes lethal damage.`] };
    }
  }
  return { ...next, pendingDeaths: [...next.pendingDeaths, ...newlyDead] };
}

export function resolveCombatDamage(state: GameState): GameState {
  let next = dealDamagePass(state, 1);
  next = markPendingDeaths(next);
  next = dealDamagePass(next, 2);
  next = markPendingDeaths(next);
  return next;
}

/** Actually moves the given creatures to their owners' graveyards (or, for
 * commanders, back to the command zone with increased tax), cascading any
 * attached Auras/Equipment off first. `verb` only changes the log wording
 * ("is destroyed" vs "is sacrificed" etc). Shared by resolvePendingDeaths
 * (combat, batched at the End Combat step) and by immediate effects like
 * sacrifice (see engine/actions.ts: chooseSacrifice). */
export function moveCreaturesToGraveyard(state: GameState, deadIds: string[], verb: string = 'is destroyed'): GameState {
  if (deadIds.length === 0) return state;
  let next = state;

  for (const id of deadIds) {
    next = detachEverythingFrom(next, id);
  }

  for (const player of next.players) {
    const dead = player.zones.battlefield.filter((c) => deadIds.includes(c.instanceId));
    if (dead.length === 0) continue;
    const survivors = player.zones.battlefield.filter((c) => !deadIds.includes(c.instanceId));

    // "When this creature dies, exile it and create N tokens" (e.g. Ancient
    // Adamantoise) redirects away from the graveyard entirely - checked
    // before the commander check, since exiling takes priority.
    const toExileWithTokens = dead.filter((d) => getCardDefinition(d.defId).onDeathExileAndCreateTokens);
    // "If a creature with a finality counter on it would die, exile it
    // instead" (Esper Origins, Relentless X-ATM092) - a replacement effect,
    // same priority tier as onDeathExileAndCreateTokens above. Per real
    // rules text, this means it never actually "dies" (exile, not
    // graveyard), so - same reasoning as toExileWithTokens - it's excluded
    // from diedCreatureCount below and from onDeath trigger eligibility
    // (engine/effects.ts: resolveOnDeathTriggers only checks the graveyard/
    // commander zones).
    const toExileFromFinality = dead.filter((d) => !toExileWithTokens.includes(d) && d.counters.some((c) => c.label === 'Finality'));
    // Ownership-aware commander check: a permanent under a TEMPORARY control
    // change (Unexpected Request, Zidane, Stiltzkin's giveaway) is still
    // sitting in `player`'s battlefield array, but a real "is this someone's
    // commander" check has to look at its actual owner's commanderDefId, not
    // whoever currently controls it - same reasoning as the graveyard/exile
    // routing below (a permanent always goes to its OWNER's zones on death,
    // never the current controller's, regardless of who controlled it when
    // it died). ownerOf/commanderDefIdFor read whichever of the two players
    // (this one or its opponent) actually owns each individual dead card.
    const opponent = getOpponent(next, player.id);
    const ownerOf = (d: CardInstance) => (d.ownerId === player.id ? player : opponent);
    const toCommandZone = dead.filter((d) => {
      if (toExileWithTokens.includes(d) || toExileFromFinality.includes(d)) return false;
      const owner = ownerOf(d);
      return !!owner.commanderDefId && frontFaceDefId(d.defId) === owner.commanderDefId;
    });
    const toGraveyard = dead.filter((d) => !toExileWithTokens.includes(d) && !toExileFromFinality.includes(d) && !toCommandZone.includes(d));

    // "Died this turn" (Deadly Embrace) only counts an actual death - a
    // creature redirected to exile by a replacement effect (toExileWithTokens,
    // e.g. Ancient Adamantoise) never technically died, matching real rules.
    const diedCreatureCount = [...toGraveyard, ...toCommandZone].filter((d) => getCardDefinition(d.defId).type === 'creature').length;
    if (diedCreatureCount > 0) next = { ...next, creaturesDiedThisTurn: next.creaturesDiedThisTurn + diedCreatureCount };

    const newTokens: CardInstance[] = [];
    for (const d of toExileWithTokens) {
      const { tokenId, count } = getCardDefinition(d.defId).onDeathExileAndCreateTokens!;
      const tokenDef = getCardDefinition(tokenId);
      for (let i = 0; i < count; i++) {
        newTokens.push({
          instanceId: nextInstanceId(),
          defId: tokenDef.id,
          ownerId: player.id,
          tapped: true,
          counters: [],
          damageMarked: 0,
          summoningSick: true,
          isToken: true,
          sacrificesOnTap: !!tokenDef.sacrificesOnTap,
        });
      }
    }

    // A permanent always goes to its OWNER's graveyard/exile/command zone on
    // death, never the current controller's - matters once control can
    // change (Unexpected Request, Zidane, Stiltzkin's giveaway ability).
    // Split each destination category by real ownership and write the
    // owner's own zones in a second updatePlayer call below; battlefield
    // removal and any death-triggered tokens still happen on `player.id`
    // (the CONTROLLER'S array/side), since that's unaffected by ownership.
    const graveyardMap = (d: CardInstance) => ({ ...d, defId: frontFaceDefId(d.defId), damageMarked: 0, tookDeathtouchDamage: false });
    const exileMap = (d: CardInstance) => ({ ...d, damageMarked: 0, tookDeathtouchDamage: false });
    const commanderMap = (d: CardInstance) => {
      const existingTax = d.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0;
      return {
        ...d,
        defId: frontFaceDefId(d.defId),
        damageMarked: 0,
        tookDeathtouchDamage: false,
        tapped: false,
        producedManaColor: undefined,
        counters: [...d.counters.filter((c) => c.label !== 'Commander Tax'), { label: 'Commander Tax', amount: existingTax + 2 }],
      };
    };
    const ownGraveyard = toGraveyard.filter((d) => d.ownerId === player.id).map(graveyardMap);
    const foreignGraveyard = toGraveyard.filter((d) => d.ownerId !== player.id).map(graveyardMap);
    const ownExile = [...toExileWithTokens.filter((d) => d.ownerId === player.id), ...toExileFromFinality.filter((d) => d.ownerId === player.id)].map(exileMap);
    const foreignExile = [...toExileWithTokens.filter((d) => d.ownerId !== player.id), ...toExileFromFinality.filter((d) => d.ownerId !== player.id)].map(exileMap);
    const ownCommander = toCommandZone.filter((d) => d.ownerId === player.id).map(commanderMap);
    const foreignCommander = toCommandZone.filter((d) => d.ownerId !== player.id).map(commanderMap);

    next = updatePlayer(next, player.id, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: [...survivors, ...newTokens],
        // frontFaceDefId: a transformed back face only exists ON the
        // battlefield - the same physical card leaving it (to the graveyard
        // or, for a commander, the command zone) reverts to its front face,
        // same as a real double-faced permanent. Applied here at the final
        // zone-write step only, AFTER onDeath eligibility above already ran
        // against the back face's own definition (the one that actually
        // died) - known gap: if a BACK face ever gets its own onDeath in the
        // future, resolveOnDeathTriggers (which runs after this returns)
        // would incorrectly see the front face's onDeath instead, since it
        // re-reads the definition from whatever's already sitting in the
        // graveyard/commander zone by then. No current card has an onDeath
        // on a back face, so this doesn't bite yet.
        graveyard: [...p.zones.graveyard, ...ownGraveyard],
        exile: [...p.zones.exile, ...ownExile],
        commander: [...p.zones.commander, ...ownCommander],
      },
    }));
    if (foreignGraveyard.length > 0 || foreignExile.length > 0 || foreignCommander.length > 0) {
      next = updatePlayer(next, opponent.id, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          graveyard: [...p.zones.graveyard, ...foreignGraveyard],
          exile: [...p.zones.exile, ...foreignExile],
          commander: [...p.zones.commander, ...foreignCommander],
        },
      }));
    }
    for (const d of toGraveyard) {
      const def = getCardDefinition(d.defId);
      next = { ...next, log: [...next.log, `${def.name} ${verb}.`] };
    }
    for (const d of toCommandZone) {
      const def = getCardDefinition(d.defId);
      next = { ...next, log: [...next.log, `${def.name} dies and returns to ${ownerOf(d).name}'s command zone.`] };
    }
    for (const d of toExileWithTokens) {
      const def = getCardDefinition(d.defId);
      const { tokenId, count } = def.onDeathExileAndCreateTokens!;
      next = { ...next, log: [...next.log, `${def.name} is exiled, creating ${count} ${getCardDefinition(tokenId).name} token(s).`] };
    }
    // "Whenever this creature or another creature or artifact you control
    // dies, target opponent loses X life and you gain Y life" (e.g. Al Bhed
    // Salvagers) - the watcher list is taken from the battlefield BEFORE
    // removal, so a watcher dying in this same batch still counts itself.
    const deathWatchers = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).onAnyDeathDrain);
    const qualifyingDeaths = dead.filter((d) => {
      const t = getCardDefinition(d.defId).type;
      return t === 'creature' || t === 'artifact';
    });
    if (deathWatchers.length > 0 && qualifyingDeaths.length > 0) {
      const opponent = getOpponent(next, player.id);
      for (const watcher of deathWatchers) {
        const watcherDef = getCardDefinition(watcher.defId);
        const { opponentLifeLoss, controllerLifeGain } = watcherDef.onAnyDeathDrain!;
        for (const d of qualifyingDeaths) {
          const dyingDef = getCardDefinition(d.defId);
          next = addLife(next, player.id, controllerLifeGain);
          next = updatePlayer(next, opponent.id, (p) => ({ ...p, life: p.life - opponentLifeLoss }));
          next = {
            ...next,
            log: [...next.log, `${dyingDef.name}'s death triggers ${watcherDef.name}: ${opponent.name} loses ${opponentLifeLoss} life, ${player.name} gains ${controllerLifeGain} life.`],
          };
        }
      }
    }

    // "Whenever one or more OTHER creatures and/or artifacts you control
    // die, draw a card. This ability triggers only once each turn." (G'raha
    // Tia) - same watcher shape as onAnyDeathDrain just above, gated by its
    // own once-per-turn flag instead of scaling with the number of deaths.
    const drawWatchers = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).onAnyDeathDraw && !c.onAnyDeathDrawUsedThisTurn);
    if (drawWatchers.length > 0 && qualifyingDeaths.length > 0) {
      for (const watcher of drawWatchers) {
        const otherDeaths = qualifyingDeaths.filter((d) => d.instanceId !== watcher.instanceId);
        if (otherDeaths.length === 0) continue;
        const watcherDef = getCardDefinition(watcher.defId);
        const drawn = getPlayer(next, player.id).zones.library.slice(0, 1);
        next = updatePlayer(next, player.id, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.map((c) => (c.instanceId === watcher.instanceId ? { ...c, onAnyDeathDrawUsedThisTurn: true } : c)),
            library: p.zones.library.slice(1),
            hand: [...p.zones.hand, ...drawn],
          },
        }));
        next = { ...next, log: [...next.log, `${watcherDef.name} triggers: ${player.name} draws a card.`] };
      }
    }

    // "Whenever a [Subtype] you control dies during your turn, you draw
    // cards equal to its power" (Jenova, Ancient Calamity) - filtered to
    // deaths matching the watcher's chosen subtype, gated to its own turn.
    // Read power from the pre-removal instance (`d`), same reasoning as
    // every other "approximate the last-known stats" spot in this pipeline.
    const subtypeDrawWatchers = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).onAnyDeathDrawEqualToPowerIfSubtype);
    if (subtypeDrawWatchers.length > 0 && qualifyingDeaths.length > 0) {
      for (const watcher of subtypeDrawWatchers) {
        const watcherDef = getCardDefinition(watcher.defId);
        const { subtype, duringOwnTurnOnly } = watcherDef.onAnyDeathDrawEqualToPowerIfSubtype!;
        if (duringOwnTurnOnly && next.activePlayerId !== player.id) continue;
        const matchingDeaths = qualifyingDeaths.filter((d) => {
          const dDef = getCardDefinition(d.defId);
          return dDef.type === 'creature' && (!!dDef.subtype?.toLowerCase().includes(subtype.toLowerCase()) || !!d.grantedSubtypes?.some((s) => s.toLowerCase() === subtype.toLowerCase()));
        });
        for (const d of matchingDeaths) {
          const dDef = getCardDefinition(d.defId);
          const amount = Math.max(0, effectivePower(dDef, d, next, player.id));
          if (amount === 0) continue;
          const drawn = getPlayer(next, player.id).zones.library.slice(0, amount);
          next = updatePlayer(next, player.id, (p) => ({
            ...p,
            zones: { ...p.zones, library: p.zones.library.slice(drawn.length), hand: [...p.zones.hand, ...drawn] },
          }));
          next = { ...next, log: [...next.log, `${dDef.name}'s death triggers ${watcherDef.name}: ${player.name} draws ${drawn.length} card(s).`] };
        }
      }
    }

    // "Whenever another creature or artifact you control dies, put a
    // [counterLabel] counter on [this]" (Judge Magister Gabranth) - same
    // watcher shape as onAnyDeathDrain, but the payout lands on the watcher
    // itself instead of changing life totals.
    const counterSelfWatchers = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).onAnyDeathCounterSelf);
    if (counterSelfWatchers.length > 0 && qualifyingDeaths.length > 0) {
      for (const watcher of counterSelfWatchers) {
        const otherDeaths = qualifyingDeaths.filter((d) => d.instanceId !== watcher.instanceId);
        if (otherDeaths.length === 0) continue;
        const watcherDef = getCardDefinition(watcher.defId);
        const { counterLabel, counterAmount } = watcherDef.onAnyDeathCounterSelf!;
        const totalAmount = counterAmount * otherDeaths.length;
        next = updatePlayer(next, player.id, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.map((c) => {
              if (c.instanceId !== watcher.instanceId) return c;
              const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
              const counters = hasCounter
                ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + totalAmount } : ctr))
                : [...c.counters, { label: counterLabel, amount: totalAmount }];
              return { ...c, counters };
            }),
          },
        }));
        next = { ...next, log: [...next.log, `${watcherDef.name} triggers: puts ${totalAmount} ${counterLabel} counter(s) on itself.`] };
      }
    }

    // "When this creature dies, put X counters on each [filter] creature you
    // control" (e.g. Aerith Gainsborough) - X is read from the dying
    // creature's OWN counters, captured above before it left the battlefield.
    for (const d of dead) {
      const def = getCardDefinition(d.defId);
      if (!def.onDeathDistributeCounters) continue;
      const { counterLabel, targetFilter } = def.onDeathDistributeCounters;
      const x = d.counters.find((c) => c.label === counterLabel)?.amount ?? 0;
      if (x <= 0) continue;
      next = updatePlayer(next, player.id, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            const cDef = getCardDefinition(c.defId);
            const isLegendary = !!cDef.subtype?.toLowerCase().includes('legendary creature');
            if (targetFilter === 'legendary' && !isLegendary) return c;
            const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
            const counters = hasCounter
              ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + x } : ctr))
              : [...c.counters, { label: counterLabel, amount: x }];
            return { ...c, counters };
          }),
        },
      }));
      next = { ...next, log: [...next.log, `${def.name}'s death puts ${x} ${counterLabel} counter(s) on each legendary creature ${player.name} controls.`] };
    }
  }

  return next;
}

/** "Fight" - two creatures simultaneously deal damage to each other equal
 * to their power (respecting deathtouch), then anything lethally damaged
 * dies IMMEDIATELY (not staged as a pendingDeath - fighting isn't combat,
 * so there's no End Combat step to wait for). Used by SelfFightTargetEffect
 * and ChooseCreaturesFightEffect. */
export function resolveFight(state: GameState, aInstanceId: string, bInstanceId: string): { state: GameState; logLines: string[] } {
  const aFound = findInstance(state, aInstanceId);
  const bFound = findInstance(state, bInstanceId);
  if (!aFound || !bFound) return { state, logLines: [] };
  const aDef = getCardDefinition(aFound.instance.defId);
  const bDef = getCardDefinition(bFound.instance.defId);
  const aPower = effectivePower(aDef, aFound.instance, state, aFound.controllerId);
  const bPower = effectivePower(bDef, bFound.instance, state, bFound.controllerId);
  const aDeathtouch = hasKeywordEffective(aDef, aFound.instance, 'deathtouch');
  const bDeathtouch = hasKeywordEffective(bDef, bFound.instance, 'deathtouch');

  let next = markDamage(state, bInstanceId, aPower, aDeathtouch);
  next = markDamage(next, aInstanceId, bPower, bDeathtouch);

  const logLines = [`${aDef.name} fights ${bDef.name}: each deals damage equal to its power to the other.`];

  const participants: [string, CardDefinition, string][] = [
    [aInstanceId, aDef, aFound.controllerId],
    [bInstanceId, bDef, bFound.controllerId],
  ];
  const dead: string[] = [];
  for (const [id, def, controllerId] of participants) {
    const found = findInstance(next, id);
    if (!found) continue;
    if (!isEffectivelyCreature(def, found.instance)) continue;
    const isIndestructible = hasKeywordEffective(def, found.instance, 'indestructible');
    const toughness = effectiveToughness(def, found.instance, next, controllerId);
    if (!isIndestructible && toughness > 0 && (found.instance.damageMarked >= toughness || found.instance.tookDeathtouchDamage)) dead.push(id);
  }
  if (dead.length > 0) {
    next = moveCreaturesToGraveyard(next, dead, 'dies from fighting');
  }

  return { state: next, logLines };
}

/** Actually moves every pending-death creature to its owner's graveyard.
 * Called when leaving the End Combat step. */
export function resolvePendingDeaths(state: GameState): GameState {
  if (state.pendingDeaths.length === 0) return state;
  const next = moveCreaturesToGraveyard(state, state.pendingDeaths);
  return { ...next, pendingDeaths: [] };
}