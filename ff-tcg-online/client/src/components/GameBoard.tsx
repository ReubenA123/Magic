import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CardDefinition, CardInstance, GameAction, GameState, ManaColor, PlayerState, ZoneName } from '../types';
import { getCardDefinition } from '../data/cards';
import { parseCostLabel, canPay, effectiveCastCost, dynamicCostReduction, manaValue } from '../engine/mana';
import { CombatKeyword, hasKeyword, hasKeywordEffective } from '../engine/keywords';
import { effectivePower, effectiveToughness, equipmentContributions, hasBoardGrantedKeyword, isLegalPendingTarget as isLegalPendingTargetShared } from '../engine/combat';
import { matchesLibrarySearchFilter, matchesReanimateFilter } from '../engine/effects';
import Card from './Card';
import PhaseBar from './PhaseBar';
import CardActionsPanel from './CardActionsPanel';
import ZoneModal from './ZoneModal';
import BlockOrderModal from './BlockOrderModal';
import BlockerPileModal from './BlockerPileModal';
import RevealDivideModal from './RevealDivideModal';
import SurveilModal from './SurveilModal';
import ReturnFromGraveyardModal from './ReturnFromGraveyardModal';
import DiscardModal from './DiscardModal';
import FreeCastModal from './FreeCastModal';
import OptionalBounceModal from './OptionalBounceModal';
import CoinFlipModal from './CoinFlipModal';
import LibrarySearchModal from './LibrarySearchModal';
import RevealNotificationModal from './RevealNotificationModal';
import RevealFilteredModal from './RevealFilteredModal';
import HideawayModal from './HideawayModal';
import CastConfirmModal from './CastConfirmModal';
import ModalSpellModal from './ModalSpellModal';
import TieredModeModal from './TieredModeModal';
import ChooseOneModeModal from './ChooseOneModeModal';
import EventLog from './EventLog';
import MutualAdjustmentControls from './MutualAdjustmentControls';
import { useMarkGameActive } from '../context/GameActivity';

interface GameBoardProps {
  state: GameState;
  yourPlayerId: string;
  actionError: string | null;
  onAction: (action: GameAction, actingPlayerId?: string) => void;
  soloControl?: boolean;
}

const MANA_COLOR_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];
const ALL_MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

function findCard(state: GameState, instanceId: string): { player: PlayerState; zone: ZoneName; card: CardInstance } | null {
  const zoneNames: ZoneName[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'commander'];
  for (const player of state.players) {
    for (const zone of zoneNames) {
      const card = player.zones[zone].find((c) => c.instanceId === instanceId);
      if (card) return { player, zone, card };
    }
  }
  return null;
}

/** Printed/temporary OR board-granted (anthem, turn-gated group grant, ...) -
 * the same "does this creature actually have this keyword right now" check
 * the engine itself uses for legality, reused here purely for combat's
 * visual flourishes (see combatZoneEl in GameBoard) so a granted keyword
 * shows the same effect a printed one would. */
function creatureHasKeywordNow(state: GameState, controllerId: string, instance: CardInstance, def: CardDefinition, keyword: CombatKeyword): boolean {
  return hasKeywordEffective(def, instance, keyword) || hasBoardGrantedKeyword(state, controllerId, instance, def, keyword);
}

const COLOR_NAMES: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

/** Which of this player's own permanents (The Darkness Crystal and its four
 * siblings - see CardDefinition.reducesCastCostForColor) are currently
 * discounting `def`'s cost, for the Modifiers breakdown in
 * CardActionsPanel - mirrors the boardWideReduction loop in engine/mana.ts:
 * dynamicCostReduction exactly, just building display text instead of a
 * number. Empty whenever nothing on the board reduces this particular
 * card's cost (wrong color, or no such permanent out). */
function costReductionSourcesFor(def: CardDefinition, player: PlayerState): { sourceName: string; text: string }[] {
  const ownCost = parseCostLabel(def.costLabel);
  const sources: { sourceName: string; text: string }[] = [];
  for (const c of player.zones.battlefield) {
    const other = getCardDefinition(c.defId);
    if (other.reducesCastCostForColor && (ownCost.colors[other.reducesCastCostForColor.color] ?? 0) > 0) {
      const colorName = COLOR_NAMES[other.reducesCastCostForColor.color] ?? other.reducesCastCostForColor.color;
      sources.push({ sourceName: other.name, text: `${colorName} spells cost ${other.reducesCastCostForColor.amount} less.` });
    }
  }
  return sources;
}

function splitBattlefield(cards: CardInstance[]) {
  const creatures: CardInstance[] = [];
  const others: CardInstance[] = [];
  const lands: CardInstance[] = [];
  for (const c of cards) {
    const def = getCardDefinition(c.defId);
    // A crewed Vehicle (see types.ts: CardDefinition.crew) renders in the
    // creatures row like any other creature - engine/combat.ts's
    // isEffectivelyCreature is the authority on this same check server-side;
    // this is display-only grouping so it's duplicated inline rather than
    // importing combat.ts into a component.
    if (def.type === 'creature' || (def.crew !== undefined && c.crewedUntilEndOfTurn)) creatures.push(c);
    else if (def.type === 'land') lands.push(c);
    else others.push(c);
  }
  // An Equipment/Aura currently attached to a creature renders nested right
  // under that creature instead (see renderCreatureCard's attached-equipment
  // row) - pulled out of `others` here so it doesn't ALSO show up floating
  // in its own row. Anything attached to a non-creature (a land/artifact
  // Aura) has nowhere else to render, so it stays in `others` as before.
  const creatureIds = new Set(creatures.map((c) => c.instanceId));
  const nestedUnderCreature = new Set(others.filter((c) => c.attachedToInstanceId && creatureIds.has(c.attachedToInstanceId)).map((c) => c.instanceId));
  return { creatures, others: others.filter((c) => !nestedUnderCreature.has(c.instanceId)), lands };
}


/**
 * Whether this instance's current power/toughness differs from its printed
 * stats right now - reuses effectivePower/effectiveToughness (the same
 * functions engine/combat.ts's real damage pass uses) rather than a
 * GameBoard-local reimplementation, so the badge can never disagree with
 * what combat actually does. Returns the creature's actual current
 * power/toughness (not just the delta), so the badge reads as "here's what
 * it is right now" rather than making the player do the addition themselves.
 */
function activeStatBadge(def: ReturnType<typeof getCardDefinition>, instance: CardInstance, state: GameState) {
  const power = effectivePower(def, instance, state, instance.ownerId);
  const toughness = effectiveToughness(def, instance, state, instance.ownerId);
  if (power === (def.power ?? 0) && toughness === (def.toughness ?? 0)) return null;
  return { power, toughness };
}

/**
 * Whether this permanent's transformSelf ability (see types.ts: CardAbility)
 * could be activated right now, as-is - same gating engine/actions.ts's
 * activateAbility actually enforces (timing, tap, mana, exile-from-graveyard),
 * just read-only here for the red "ready to transform" outline. A card with
 * no transformSelf ability at all always returns false.
 */
function canTransformNow(def: ReturnType<typeof getCardDefinition>, instance: CardInstance, state: GameState): boolean {
  const ability = def.abilities?.find((a) => a.transformSelf);
  if (!ability) return false;
  const owner = state.players.find((p) => p.id === instance.ownerId);
  if (!owner) return false;
  const mutual = state.mutualAdjustment.status === 'active';

  if (!mutual && ability.onlyDuringOwnEndStep && (state.phase !== 'end' || state.activePlayerId !== instance.ownerId)) return false;
  if (!mutual && ability.onlyDuringOwnFirstMainPhase && (state.phase !== 'main1' || state.activePlayerId !== instance.ownerId)) return false;
  if (!mutual && ability.onlyDuringOwnUpkeep && (state.phase !== 'upkeep' || state.activePlayerId !== instance.ownerId)) return false;
  if (ability.requiresGraveyardSize && owner.zones.graveyard.length < ability.requiresGraveyardSize) return false;
  if (ability.cost.tap && instance.tapped) return false;
  if (!mutual && ability.cost.tap && def.type === 'creature' && instance.summoningSick) return false;
  const manaCost = ability.cost.manaLabel ? parseCostLabel(ability.cost.manaLabel) : null;
  if (!mutual && manaCost && !canPay(owner.manaPool, manaCost, 0)) return false;
  const exileCost = ability.cost.exileFromGraveyard ?? 0;
  if (exileCost > 0 && owner.zones.graveyard.length < exileCost) return false;

  return true;
}

/**
 * RevealTopThenLoseLifeByManaValueEffect's (Dark Confidant) two-state
 * outline - 'red' while this exact instance's reveal is sitting in
 * GameState.pendingRevealPickup waiting for its controller to click the
 * revealed card (on their library pile) to pick it up, 'purple' from the
 * moment they do that until their next upkeep sets pendingRevealPickup
 * again. Undefined for a permanent that's never triggered the effect at
 * all yet (CardInstance.revealedCardIds still empty/unset).
 */
function revealOutlineFor(state: GameState, instance: CardInstance): 'red' | 'purple' | undefined {
  if (state.pendingRevealPickup?.sourceInstanceId === instance.instanceId) return 'red';
  if ((instance.revealedCardIds?.length ?? 0) > 0) return 'purple';
  return undefined;
}

/** MayPayLifeThenEffect's (Seymour Flux) "you may" is outstanding on this
 * exact permanent right now - see GameState.pendingOptionalPayLife. Drives
 * a purple outline so the choice waiting on it (the banner near the top of
 * the board) is obvious at a glance during upkeep, distinct from
 * revealOutlineFor's dimmer "already resolved, informational" purple. */
function awaitingOptionalPayLife(state: GameState, instance: CardInstance): boolean {
  return state.pendingOptionalPayLife?.sourceInstanceId === instance.instanceId;
}

/**
 * A single, unambiguous blocker (no order to decide) means we already know
 * exactly how the exchange resolves - mirrors engine/combat.ts's dealDamagePass
 * for the one-blocker case (full power each way, no split needed) so this
 * preview matches what actually happens once both players hit Resolve Combat.
 * With 2+ blockers the attacker still has to choose an order (see
 * BlockOrderModal) before any of that is decided, so callers should only use
 * this when there's exactly one blocker.
 */
function previewSingleBlockDeaths(
  attackerDef: ReturnType<typeof getCardDefinition>,
  attackerInstance: CardInstance,
  attackerControllerId: string,
  blockerDef: ReturnType<typeof getCardDefinition>,
  blockerInstance: CardInstance,
  blockerControllerId: string,
  state: GameState,
) {
  // Reuses the SAME stat/keyword functions engine/combat.ts's real damage
  // pass uses (rather than a separate, partial reimplementation) so this
  // preview can never disagree with what Resolve Combat actually does - it
  // previously used a GameBoard-local counterAdjustedStat that only knew
  // about +1/+1 counters and landCountBuff, missing temporaryBuff (any pump
  // effect/spell) and Equipment bonuses entirely, which could grey out a
  // creature as "about to die" when a buff or equipped bonus it wasn't
  // counting actually kept it alive.
  const attackerPower = effectivePower(attackerDef, attackerInstance, state, attackerControllerId);
  const blockerPower = effectivePower(blockerDef, blockerInstance, state, blockerControllerId);
  const attackerToughnessLeft = Math.max(0, effectiveToughness(attackerDef, attackerInstance, state, attackerControllerId) - attackerInstance.damageMarked);
  const blockerToughnessLeft = Math.max(0, effectiveToughness(blockerDef, blockerInstance, state, blockerControllerId) - blockerInstance.damageMarked);
  const attackerIndestructible = hasKeywordEffective(attackerDef, attackerInstance, 'indestructible');
  const blockerIndestructible = hasKeywordEffective(blockerDef, blockerInstance, 'indestructible');
  const attackerDeathtouch = hasKeyword(attackerDef, 'deathtouch');
  const blockerDeathtouch = hasKeyword(blockerDef, 'deathtouch');
  return {
    // Deathtouch: any nonzero damage from that source is lethal regardless
    // of toughness left, unless indestructible - mirrors engine/combat.ts's
    // markPendingDeaths exactly, so this preview never disagrees with what
    // Resolve Combat is about to actually do.
    attackerDies: !attackerIndestructible && attackerToughnessLeft > 0 && (blockerPower >= attackerToughnessLeft || (blockerDeathtouch && blockerPower > 0)),
    blockerDies: !blockerIndestructible && blockerToughnessLeft > 0 && (attackerPower >= blockerToughnessLeft || (attackerDeathtouch && attackerPower > 0)),
  };
}

/**
 * Which tapped cards in a group could actually be untapped right now - a
 * tapped card that never produced mana (or whose mana is untracked) is
 * always fine, but one whose mana is already spent stays tapped until the
 * next untap step (see engine/actions.ts: toggleTap). Walks in order,
 * greedily claiming each color's remaining pool so cards sharing a color
 * don't get double-counted as refundable against the same unit of mana.
 */
function untappableCardsInGroup(group: CardInstance[], manaPool: Record<ManaColor, number>): CardInstance[] {
  const remainingByColor = new Map<ManaColor, number>();
  const result: CardInstance[] = [];
  for (const c of group) {
    if (!c.tapped) continue;
    if (!c.producedManaColor) {
      result.push(c);
      continue;
    }
    const color = c.producedManaColor;
    const remaining = remainingByColor.has(color) ? remainingByColor.get(color)! : manaPool[color];
    // Ring of the Lucii's "T: Add MM" needs the full 2 colorless still
    // unspent to be refundable - everything else defaults to 1. Everflowing
    // Chalice's producesManaAmountEqualToOwnCounterLabel is read live off
    // this specific card instance instead of a fixed printed number.
    const def = getCardDefinition(c.defId);
    const producedAmount = def.producesManaAmountEqualToOwnCounterLabel ? c.counters.find((ctr) => ctr.label === def.producesManaAmountEqualToOwnCounterLabel)?.amount ?? 0 : def.producesManaAmount ?? 1;
    if (remaining >= producedAmount) {
      result.push(c);
      remainingByColor.set(color, remaining - producedAmount);
    } else {
      remainingByColor.set(color, remaining);
    }
  }
  return result;
}

/**
 * Groups battlefield permanents that share a name into stacks, purely for
 * display - each CardInstance stays independent in game state. A card with
 * any counter, or one excluded by the caller (e.g. mid-death), always stays
 * its own singleton group so it's never hidden inside a pile. Order follows
 * each group's first member, so stacks stay put where they first appeared.
 */
function groupForStacking(cards: CardInstance[], isExcluded?: (c: CardInstance) => boolean): CardInstance[][] {
  const groups: CardInstance[][] = [];
  const byName = new Map<string, CardInstance[]>();
  for (const c of cards) {
    if (c.counters.length > 0 || isExcluded?.(c)) {
      groups.push([c]);
      continue;
    }
    const name = getCardDefinition(c.defId).name;
    let group = byName.get(name);
    if (!group) {
      group = [];
      byName.set(name, group);
      groups.push(group);
    }
    group.push(c);
  }
  return groups;
}

function ManaRow({ player }: { player: PlayerState }) {
  const total = Object.values(player.manaPool).reduce((a, b) => a + b, 0);
  if (total === 0) return <div className="mana-row mana-row-empty">No mana</div>;
  const badges: ManaColor[] = [];
  for (const color of MANA_COLOR_ORDER) {
    for (let i = 0; i < player.manaPool[color]; i++) badges.push(color);
  }
  return (
    <div className="mana-row">
      {badges.map((c, i) => (
        <span key={i} className={`mana-badge mana-${c}`}>
          {c}
        </span>
      ))}
      <span className="mana-total">({total})</span>
    </div>
  );
}

/**
 * The tap/untap control strip shown under a stack of 2+ identical permanents.
 * For a single-color land: left = untap (its +/- adjust how many to untap),
 * right = tap (its +/- adjust how many to tap) - set the amount, press
 * Untap/Tap to act on exactly that many at once.
 *
 * For a dual/any-color land, quantity alone can't say which color each card
 * should produce or is refunding, so both sides become color pips instead:
 * tap-side pips are the land's full set of options (always the same,
 * click one to tap the next untapped card for that color); untap-side pips
 * are only the colors actually sitting tapped-and-unspent in the stack right
 * now - tap a G, and only G shows up to untap, not the land's other color(s),
 * since there's nothing of those to give back yet.
 */
function StackTapControls({
  untappedCount,
  untappableCount,
  onTapN,
  onUntapN,
  tapColorOptions,
  onTapColor,
  untapColorOptions,
  onUntapColor,
}: {
  untappedCount: number;
  /** Of the tapped cards, how many could actually be untapped right now -
   * fewer than the tapped total once some of their mana has already been spent. */
  untappableCount: number;
  onTapN: (n: number) => void;
  onUntapN: (n: number) => void;
  /** The land's full set of mana options - always the same regardless of
   * current state. Undefined for a single-color land (no choice to pip). */
  tapColorOptions?: ManaColor[];
  onTapColor?: (color: ManaColor) => void;
  /** Which colors are actually refundable right now - a subset of
   * tapColorOptions (or empty), recomputed as cards get tapped/spent. */
  untapColorOptions?: ManaColor[];
  onUntapColor?: (color: ManaColor) => void;
}) {
  const [untapAmount, setUntapAmount] = useState(1);
  const [tapAmount, setTapAmount] = useState(1);

  const clampedUntap = Math.min(Math.max(untapAmount, 1), Math.max(untappableCount, 1));
  const clampedTap = Math.min(Math.max(tapAmount, 1), Math.max(untappedCount, 1));

  return (
    <div className="stack-tap-controls">
      <div className="stack-tap-row">
        {tapColorOptions ? (
          <div className="stack-tap-group battlefield-mana-pips">
            {untapColorOptions && untapColorOptions.length > 0 ? (
              untapColorOptions.map((color) => (
                <button key={color} className={`mana-tap-pip mana-${color} mana-tap-pip-spent`} title={`Untap one ${color}`} onClick={() => onUntapColor?.(color)}>
                  {color}
                </button>
              ))
            ) : (
              <span className="stack-tap-nothing" title="Nothing to untap yet">
                {'—'}
              </span>
            )}
          </div>
        ) : (
          <div className="stack-tap-group">
            <button
              className="stack-tap-step"
              disabled={untappableCount === 0}
              onClick={() => setUntapAmount((n) => Math.max(1, n - 1))}
              title={untappableCount === 0 ? "This stack's mana has already been spent" : 'Fewer to untap'}
            >
              −
            </button>
            <input
              className="stack-tap-input"
              type="number"
              min={1}
              max={Math.max(untappableCount, 1)}
              value={clampedUntap}
              disabled={untappableCount === 0}
              onChange={(e) => setUntapAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            <button
              className="stack-tap-step"
              disabled={untappableCount === 0}
              onClick={() => setUntapAmount((n) => Math.min(untappableCount, n + 1))}
              title={untappableCount === 0 ? "This stack's mana has already been spent" : 'More to untap'}
            >
              +
            </button>
          </div>
        )}
        <span className="battlefield-stack-count" title="Cards still tappable">
          {untappedCount}
        </span>
        {tapColorOptions ? (
          <div className="stack-tap-group battlefield-mana-pips">
            {tapColorOptions.map((color) => (
              <button
                key={color}
                className={`mana-tap-pip mana-${color}`}
                disabled={untappedCount === 0}
                title={untappedCount === 0 ? 'Nothing left to tap' : `Tap one for ${color}`}
                onClick={() => onTapColor?.(color)}
              >
                {color}
              </button>
            ))}
          </div>
        ) : (
          <div className="stack-tap-group">
            <button className="stack-tap-step" disabled={untappedCount === 0} onClick={() => setTapAmount((n) => Math.max(1, n - 1))} title="Fewer to tap">
              −
            </button>
            <input
              className="stack-tap-input"
              type="number"
              min={1}
              max={Math.max(untappedCount, 1)}
              value={clampedTap}
              disabled={untappedCount === 0}
              onChange={(e) => setTapAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            <button className="stack-tap-step" disabled={untappedCount === 0} onClick={() => setTapAmount((n) => Math.min(untappedCount, n + 1))} title="More to tap">
              +
            </button>
          </div>
        )}
      </div>
      {!tapColorOptions && (
        <div className="stack-tap-row">
          <button
            className="stack-tap-commit"
            disabled={untappableCount === 0}
            title={untappableCount === 0 ? "This stack's mana has already been spent" : ''}
            onClick={() => onUntapN(clampedUntap)}
          >
            Untap
          </button>
          <button className="stack-tap-commit" disabled={untappedCount === 0} onClick={() => onTapN(clampedTap)}>
            Tap
          </button>
        </div>
      )}
    </div>
  );
}

interface SelectionBox {
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ManaChoiceItem {
  instanceId: string;
  options: ManaColor[];
}

// Keep in sync with the "one consistent card size everywhere on the board"
// override in styles.css.
const CARD_WIDTH = 200;
const CARD_HEIGHT = 268;
const STACK_PEEK_STEP = 8;
const STACK_PEEK_MAX_LAYERS = 4;
const STACK_CONTROL_HEIGHT = 60;

const MIN_FULL_BOARD_ZOOM = 0.35;
const MAX_FULL_BOARD_ZOOM = 1;
const FULL_BOARD_ZOOM_STEP = 0.05;

// Must match .game-board-layout's own top+bottom padding in styles.css (12px
// + 100px) - My View/Opponent View's auto-fit zoom uses this to work out how
// much of the viewport height is actually available for the board itself.
const GAME_BOARD_LAYOUT_VERTICAL_PADDING = 112;

export default function GameBoard({ state, yourPlayerId, actionError, onAction, soloControl }: GameBoardProps) {
  useMarkGameActive();
  const you = state.players.find((p) => p.id === yourPlayerId)!;
  const opponent = state.players.find((p) => p.id !== yourPlayerId)!;
  const isYourTurn = soloControl ? true : state.activePlayerId === yourPlayerId;
  const mutualActive = state.mutualAdjustment.status === 'active';
  const pendingTargetForYou =
    state.pendingTarget && !state.pendingWardPayment && (state.pendingTarget.controllerId === yourPlayerId || soloControl) ? state.pendingTarget : null;
  const pendingTargetSourceName = pendingTargetForYou ? getCardDefinition(findCard(state, pendingTargetForYou.sourceInstanceId)?.card.defId ?? '')?.name ?? 'Ability' : '';
  const pendingSacrificeForYou = state.pendingSacrifice && (state.pendingSacrifice.remainingPlayerIds[0] === yourPlayerId || soloControl) ? state.pendingSacrifice : null;
  const pendingKeepOneSacrificeRestForYou =
    state.pendingKeepOneSacrificeRest && (state.pendingKeepOneSacrificeRest.remainingPlayerIds[0] === yourPlayerId || soloControl) ? state.pendingKeepOneSacrificeRest : null;
  const pendingCounterTransfer = state.pendingCounterTransferQueue[0];
  const pendingCounterTransferForYou = pendingCounterTransfer && (pendingCounterTransfer.controllerId === yourPlayerId || soloControl) ? pendingCounterTransfer : null;

  const [openPanelId, setOpenPanelId] = useState<string | null>(null);
  // Purely cosmetic: which card within an equipment/creature battlefield
  // stack (renderCreatureCard) is currently drawn on top - keyed by the
  // creature's own instanceId (stable for as long as the stack exists), an
  // offset into [creature, ...attachedEquipment] rather than a card id, so
  // it doesn't need clearing when equipment attaches/detaches. Advanced by
  // the stack's cycle arrows so a deep stack (more attached equipment than
  // STACK_PEEK_MAX_LAYERS can peek) can still bring every card to the front
  // to look at, without changing who actually controls/can attack with the
  // creature underneath.
  const [stackCycleOffset, setStackCycleOffset] = useState<Record<string, number>>({});
  // Set while the Equip/Attach button's target pick is outstanding - the
  // ATTACH_CARD action needs a targetInstanceId, but CardActionsPanel's
  // "Equip" button (onStartAttach) has no board access to pick one itself,
  // so it just requests this pending state and the click-to-choose-a-target
  // flow lives here instead (same shape as pendingTarget, just locally
  // owned rather than server state, since "which creature am I about to
  // equip this to" is a pure UI selection with no other visible effect
  // until ATTACH_CARD actually fires).
  const [pendingAttach, setPendingAttach] = useState<{ instanceId: string; ownerId: string } | null>(null);
  const [openZone, setOpenZone] = useState<{ playerId: string; zone: 'graveyard' | 'exile' } | null>(null);
  // Library/graveyard/exile now share one corner spot instead of three -
  // this is which one is currently the "front" pile for each player (keyed
  // by player id, since your corner and the opponent's cycle independently).
  // Purely a local display preference, not game state - defaults to
  // 'library' (via the ?? fallback below) for anyone not in this map yet.
  const [activeCornerZone, setActiveCornerZone] = useState<Record<string, 'library' | 'graveyard' | 'exile'>>({});
  // Lets you collapse EITHER corner (yours or the opponent's -
  // commander/library/graveyard/exile) down to a thin strip at any time, to
  // reclaim board space - most useful in Full Board during combat where
  // every column is competing for room. Keyed by player id. Undefined for a
  // player defaults to shown for you, hidden for the opponent (see
  // buildPlayerZonePieces's storedCornerCollapsed) - both are just starting
  // points once a corner's actually been toggled explicitly.
  const [collapsedCorners, setCollapsedCorners] = useState<Record<string, boolean>>({});
  const [selectedAttackers, setSelectedAttackers] = useState<Set<string>>(new Set());
  const [blockerAssignments, setBlockerAssignments] = useState<Record<string, string[]>>({});
  const [pendingBlocker, setPendingBlocker] = useState<string | null>(null);
  const [draggedInstanceId, setDraggedInstanceId] = useState<string | null>(null);
  // Set instead of casting immediately whenever a hand/commander-zone card is
  // dropped onto the battlefield - dragging is easy to do by accident, so
  // CastConfirmModal makes the actual cast a separate, deliberate step.
  const [pendingCastConfirm, setPendingCastConfirm] = useState<CardInstance | null>(null);
  // Set instead of dispatching immediately whenever a "Choose one or more"
  // modal spell (see types.ts: CardDefinition.chooseModes) is cast - the
  // player checks a nonempty subset of modes, then Cast dispatches a single
  // CAST_CARD with chosenModeIndices.
  const [pendingModalCast, setPendingModalCast] = useState<CardInstance | null>(null);
  // Same idea as pendingModalCast, but for "Tiered (Choose one additional
  // cost.)" spells (see types.ts: CardDefinition.tieredModes) - exactly one
  // tier is picked, then Cast dispatches CAST_CARD with chosenTierIndex.
  const [pendingTieredCast, setPendingTieredCast] = useState<CardInstance | null>(null);
  // Same idea again, for "Kicker - [cost]" spells (see types.ts:
  // CardDefinition.kicker) - the player either picks a specific permanent
  // to pay the kicker cost with (dispatching CAST_CARD with
  // kickerPaymentInstanceId), or skips to cast unkicked.
  const [pendingKickerCast, setPendingKickerCast] = useState<CardInstance | null>(null);
  // Set while a CardDefinition.escalateCost spell (Collective Effort) is
  // waiting on the player to click which untapped creature(s) to tap as its
  // Escalate payment - only armed when 2+ modes were checked in
  // ModalSpellModal (a single mode is always free). Same click-accumulation
  // shape as pendingSacrificeCost just below, but the eventual dispatch is
  // CAST_CARD (with the already-chosen chosenModeIndices carried along)
  // rather than ACTIVATE_ABILITY.
  const [pendingEscalateCost, setPendingEscalateCost] = useState<{
    instanceId: string;
    ownerId: string;
    chosenModeIndices: number[];
    count: number;
    selected: string[];
  } | null>(null);
  // Set while an ability with a sacrificeAnother cost (e.g. Ahriman, or The
  // Gold Saucer's "Sacrifice two artifacts") is waiting on the player to
  // click which OTHER permanent(s) to sacrifice - the choice is
  // strategically meaningful, so it's picked client-side, accumulating into
  // `selected` one click at a time, before a single atomic ACTIVATE_ABILITY
  // dispatch carries all of them as costTargetInstanceIds the moment
  // `selected.length` reaches `count` (see types.ts:
  // CardAbility.cost.sacrificeAnother/sacrificeAnotherCount).
  const [pendingSacrificeCost, setPendingSacrificeCost] = useState<{
    instanceId: string;
    abilityId: string;
    ownerId: string;
    filter: 'creature' | 'artifact' | 'artifactOrCreature' | 'nonlandPermanent';
    count: number;
    selected: string[];
  } | null>(null);
  // Same single-pick, choice-arrives-baked-in-costTargetInstanceIds shape as
  // pendingSacrificeCost above, for CardAbility.cost.removeCounterFromAnotherPermanent
  // (O'aka, Traveling Merchant's "remove a counter from a nonland permanent
  // you control") - always count 1, so a click dispatches immediately.
  const [pendingCounterRemovalCost, setPendingCounterRemovalCost] = useState<{ instanceId: string; abilityId: string; ownerId: string } | null>(null);
  // Whether to currently show CoinFlipModal's animated reveal for
  // state.lastCoinFlip (The Gold Saucer) - purely local/client-side, since
  // the actual flip already resolved server-side the instant it was called
  // (see engine/actions.ts: chooseCoinSide). lastCoinFlipIdShown tracks
  // which flip's id has already been animated, so a page re-render (or a
  // stale lastCoinFlip surviving from before a reconnect) doesn't replay an
  // old flip's animation - only a genuinely NEW id triggers it.
  const [showingCoinFlipResult, setShowingCoinFlipResult] = useState(false);
  const lastCoinFlipIdShown = useRef<string | null>(null);
  useEffect(() => {
    if (state.lastCoinFlip && state.lastCoinFlip.id !== lastCoinFlipIdShown.current) {
      lastCoinFlipIdShown.current = state.lastCoinFlip.id;
      setShowingCoinFlipResult(true);
    }
  }, [state.lastCoinFlip]);
  // Same "already happened server-side, just show a passing notification"
  // shape as lastCoinFlip above, for GameState.lastReveal (a
  // pendingLibrarySearch pick, currently the only source of a reveal).
  // instanceId doubles as the dedup key here - lastCoinFlip has its own
  // dedicated `id` field, but a fresh reveal is always a fresh instanceId
  // in practice (the found card was just pulled out of the library).
  const [showingRevealResult, setShowingRevealResult] = useState(false);
  const lastRevealIdShown = useRef<string | null>(null);
  useEffect(() => {
    if (state.lastReveal && state.lastReveal.instanceId !== lastRevealIdShown.current) {
      lastRevealIdShown.current = state.lastReveal.instanceId;
      setShowingRevealResult(true);
    }
  }, [state.lastReveal]);
  // Set while crewing a Vehicle (see types.ts: CardDefinition.crew) is in
  // progress - the player toggles any number of their own untapped creatures
  // on/off, then presses Confirm to dispatch a single CREW_VEHICLE action.
  // Unlike sacrificeAnother's single pick, Crew needs a variable-size set
  // chosen before submitting, so this tracks a running selection instead of
  // dispatching on the first click.
  const [pendingCrew, setPendingCrew] = useState<{ instanceId: string; ownerId: string; crewCost: number; selected: string[] } | null>(null);
  // Set while casting a CardDefinition.convoke spell (Clever Concealment) is
  // waiting on the player to click which untapped creature(s) to tap toward
  // its cost - same running-selection shape as pendingCrew above, except
  // there's no fixed count to reach (0 is a legal choice, just pays the full
  // mana cost) so a separate Cast button confirms instead of auto-dispatching.
  const [pendingConvokeCast, setPendingConvokeCast] = useState<{ instanceId: string; ownerId: string; selected: string[] } | null>(null);
  const [handOrder, setHandOrder] = useState<string[]>([]);
  const [boardOrder, setBoardOrder] = useState<Record<string, string[]>>({});
  const [winnerDismissed, setWinnerDismissed] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [concedeHolding, setConcedeHolding] = useState(false);
  const concedeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phaseBoxPos, setPhaseBoxPos] = useState<{ x: number; y: number } | null>(null);
  const [manaChoiceQueue, setManaChoiceQueue] = useState<ManaChoiceItem[]>([]);
  const [viewMode, setViewMode] = useState<'mine' | 'opponent' | 'full'>('mine');
  // Each view remembers its own zoom. My View/Opponent View start at natural
  // size (100%). Full Board's commander/graveyard columns now live outside
  // the scaled area entirely (see buildPlayerZonePieces/full-board-grid), so
  // shrinking the middle no longer drags them in from the screen edges -
  // Full Board can default to a real "see both boards" zoom again.
  const [zoomByMode, setZoomByMode] = useState<Record<'mine' | 'opponent' | 'full', number>>({
    mine: 1,
    opponent: 1,
    full: 0.8,
  });
  const [editingZoom, setEditingZoom] = useState(false);
  const [boardViewExpanded, setBoardViewExpanded] = useState(false);
  // Mutual Adjustment/Concede moved out of the Board View panel and behind
  // their own small arrow next to the turn box - collapsed by default so
  // they're out of the way, but always one click away right next to
  // Next Phase/End Turn instead of buried in a separate panel across the screen.
  const [turnExtrasExpanded, setTurnExtrasExpanded] = useState(false);
  // Full Board only - lets a crowded creatures/others/lands row collapse to
  // a thin summary strip so the two boards fit together more comfortably.
  // Keyed "playerId:rowKey" since either player's board can be full there.
  const [minimizedRows, setMinimizedRows] = useState<Set<string>>(new Set());
  function toggleRowMinimized(key: string) {
    setMinimizedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const [orderedAttackerIds, setOrderedAttackerIds] = useState<Set<string>>(new Set());
  const [openBlockerPile, setOpenBlockerPile] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const landsRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const combatZoneRef = useRef<HTMLDivElement | null>(null);
  const firstBlockerSlotRef = useRef<HTMLDivElement | null>(null);
  const phaseDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const [naturalBoardHeight, setNaturalBoardHeight] = useState(0);
  const boardResizeObserverRef = useRef<ResizeObserver | null>(null);
  // Drives the auto-fit zoom below - My View/Opponent View have no manual
  // zoom control (see effectiveViewMode !== 'full' guards further down), so
  // their fit has to react to the viewport itself resizing, not just the
  // board's own content height.
  const [windowHeight, setWindowHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    function handleResize() {
      setWindowHeight(window.innerHeight);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Full Board's zoom uses transform: scale, not the CSS `zoom` property -
  // zoom actually resizes layout, so any resize (however small) makes the
  // player's current scroll position point at different content, which is
  // exactly what kept "scrolling" the page out from under them. transform
  // never touches layout at all, so there's nothing for scroll to get
  // confused about - but since it doesn't reserve the smaller visual space
  // either, a ResizeObserver tracks the board's real (unscaled) height so
  // the wrapper below can be told to take up exactly `height * zoom` and
  // clip away the rest, instead of leaving a tall gap under a shrunk board.
  //
  // This has to be a callback ref, not a plain useRef + one-shot effect:
  // Full Board's wrapper sits one level deeper (inside .full-board-grid)
  // than My View/Opponent View's, so switching into or out of Full Board
  // unmounts and remounts this div rather than just changing its content. A
  // `useEffect(() => {...}, [])` would only ever observe the very first
  // instance - once that one's gone, naturalBoardHeight freezes at whatever
  // it last was (usually My View's taller, unscaled reading), reserving too
  // much height and leaving empty space below the shorter Full Board content.
  const gameBoardMainRef = useCallback((el: HTMLDivElement | null) => {
    boardResizeObserverRef.current?.disconnect();
    boardResizeObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setNaturalBoardHeight(entry.contentRect.height);
    });
    observer.observe(el);
    boardResizeObserverRef.current = observer;
  }, []);

  // GameBoard mounts fresh exactly once per game (Versus swaps in from
  // PregameSetup once both players are ready; VS AI mounts it the moment a
  // deck is picked). Landing at the top of a much-taller-than-viewport page
  // and having to scroll down to find your own hand felt off, so jump
  // straight to the bottom - same target My View already uses when you
  // switch back into it. Two frames so this runs after the first real
  // layout (and the ResizeObserver's follow-up) settle, same as changeViewMode.
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
    });
  }, []);


  // Switching view mode swaps in a different amount of content above the
  // fold, and Full Board also changes zoom level going in or out (each view
  // has its own) - between the content swap and the wrapper's height
  // catching up once the ResizeObserver above reports the new
  // naturalBoardHeight (a render *after* the swap itself), the page's total
  // height changes in a way scroll position can't stay meaningful across.
  //
  // My View/Opponent View put their controls at the very bottom of a much
  // shorter page than Full Board's, so landing at the bottom of the page is
  // the sensible target there; going back to Full Board just restores
  // wherever the player was. Either way, wait two animation frames first so
  // this runs after both the content swap and the ResizeObserver's
  // follow-up layout settle, not just the first of the two.
  function changeViewMode(mode: 'mine' | 'opponent' | 'full') {
    const anchor = { x: window.scrollX, y: window.scrollY };
    setViewMode(mode);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (mode === 'full') window.scrollTo(anchor.x, anchor.y);
        else window.scrollTo(anchor.x, document.documentElement.scrollHeight);
      });
    });
  }

  useEffect(() => {
    if (state.phase !== 'untap' || !isYourTurn) return;
    const timer = setTimeout(() => onAction({ type: 'NEXT_PHASE' }, state.activePlayerId), 2000);
    return () => clearTimeout(timer);
  }, [state.phase, state.turnNumber, state.activePlayerId, isYourTurn, onAction]);

  useEffect(() => {
    if (!state.winnerId) setWinnerDismissed(false);
  }, [state.winnerId]);

  useEffect(() => {
    setSelectedAttackers(new Set());
    setBlockerAssignments({});
    setPendingBlocker(null);
    setMultiSelected(new Set());
    setDraggedInstanceId(null);
    setOpenBlockerPile(null);
  }, [state.turnNumber]);

  // A fresh combat starting (new attackers declared) always clears any
  // leftover blocker assignments from an earlier combat this same turn.
  useEffect(() => {
    setBlockerAssignments({});
    setPendingBlocker(null);
    setOrderedAttackerIds(new Set());
    setOpenBlockerPile(null);
  }, [state.declaredAttackers]);

  const openCard = openPanelId ? findCard(state, openPanelId) : null;
  // Clicking an opponent's card (now possible from Opponent View/Full Board -
  // see isOpponentViewLocked) opens the same preview panel as your own cards,
  // but it should only ever be a look, never a way to tap/cast/activate
  // their stuff - a card only ever changes because the rules say so (its
  // controller casting it, combat, an effect), not because someone else
  // reached over and touched it. That holds even in VS AI (soloControl) -
  // the AI plays its own turn through useLocalGame's own dispatches, so it
  // never needed a manual-override door here, and leaving one in would just
  // be a way to cheat against it. Mutual Adjustment is the one deliberate
  // exception: both players explicitly agreed to suspend this.
  // "You may play that card" (Lightning, Security Sergeant; Reno and Rude) -
  // the exiled card's OWNER can be the opponent (Reno and Rude exiles from
  // the opponent's library), but the GRANT HOLDER is who actually gets to
  // act on it, so a grant naming the viewer punches through the normal
  // "only ever a look at someone else's card" rule below, same as Mutual
  // Adjustment does. See GameState.exilePlayGrants.
  const openCardExilePlayGrant =
    openCard?.zone === 'exile' ? (state.exilePlayGrants.find((g) => g.instanceId === openCard.card.instanceId && g.playerId === yourPlayerId) ?? null) : null;
  // "You may play lands and cast spells from the top of your library."
  // (Kefka's Tower) - a LIVE board-state permission (unlike exilePlayGrants'
  // per-card queue), so this just checks whether the open card genuinely IS
  // the top of ITS OWN owner's library and that owner currently controls a
  // granting permanent. Always your own library (no cross-player grant
  // mechanic here), so this never needs to punch through openCardIsReadOnly
  // below the way openCardExilePlayGrant does - the `=== yourPlayerId` check
  // already implies it.
  const openCardLibraryTopGranter =
    openCard &&
    openCard.zone === 'library' &&
    openCard.player.id === yourPlayerId &&
    openCard.player.zones.library[0]?.instanceId === openCard.card.instanceId
      ? openCard.player.zones.battlefield.find((c) => !!getCardDefinition(c.defId).grantsPlayFromTopOfLibrary)
      : undefined;
  const openCardLibraryTopPlayAllowed = openCardLibraryTopGranter ? getCardDefinition(openCardLibraryTopGranter.defId).grantsPlayFromTopOfLibrary! : null;
  const openCardIsReadOnly = !!openCard && openCard.player.id !== yourPlayerId && !mutualActive && !openCardExilePlayGrant;

  // Equipment/Aura attached to a creature on the battlefield - lets the open
  // panel cycle between the creature and whatever's attached to it (or, if
  // you opened the attached card itself, back to its host and any siblings)
  // via arrows in the panel header, rather than having to close the panel
  // and go hunt for the tiny stack-cycle arrows on the battlefield card
  // itself (see renderCreatureCard's stack-cycle-arrow buttons).
  const openCardCycleGroup = (() => {
    if (!openCard || openCard.zone !== 'battlefield') return null;
    const battlefield = openCard.player.zones.battlefield;
    const hostId = openCard.card.attachedToInstanceId ?? openCard.card.instanceId;
    const host = battlefield.find((c) => c.instanceId === hostId);
    if (!host) return null;
    const attachments = battlefield.filter((c) => c.attachedToInstanceId === hostId);
    if (attachments.length === 0) return null;
    return [host, ...attachments].map((c) => ({ instanceId: c.instanceId, name: getCardDefinition(c.defId).name }));
  })();

  // soloControl (VS AI) means the same person plays both sides, so whichever
  // side needs to declare attackers/blockers right now, it's them - without
  // the soloControl check here, these both stayed hard-wired to "only the
  // side matching yourPlayerId" (fixed to the human, player[0]), which meant
  // attacking on your OWN turn against the AI never showed the blocker
  // step at all (activePlayerId === yourPlayerId, so isDeclaringBlockers was
  // always false) - combat just got stuck with no way to assign blocks
  // (or decline to) and nothing to click.
  const isDeclaringAttackers = state.phase === 'declare_attackers' && (soloControl || state.activePlayerId === yourPlayerId);
  const isDeclaringBlockers = state.phase === 'declare_blockers' && (soloControl || state.activePlayerId !== yourPlayerId);
  /** The attacker's own side of declare_blockers - genuinely nothing to do
   * but wait on the defending player. Without this, PhaseBar (which only
   * gates its Next/End Turn buttons on isYourTurn, and it's still your turn
   * here) showed an enabled "Next" button that engine/actions.ts: nextPhase
   * always rejects with "Waiting on the defending player's blocks." -
   * clicking it did nothing visible beyond a brief error toast, which read
   * as the game being frozen. Not shown in soloControl (VS AI) - there the
   * same person controls both sides, so there's no separate opponent to
   * "wait" on. */
  const isWaitingOnBlockers = !soloControl && state.phase === 'declare_blockers' && state.activePlayerId === yourPlayerId;
  const showCombatZones = isDeclaringAttackers || isDeclaringBlockers || state.phase === 'combat_damage' || state.phase === 'combat_end';
  // Combat needs both sides visible to declare attackers/blockers sensibly,
  // so it always shows Full Board regardless of what's selected below.
  const effectiveViewMode = showCombatZones ? 'full' : viewMode;
  // My View/Opponent View only ever show a single board and always need to
  // fit it into the viewport with nothing left to scroll to - rather than
  // trust a manually-set zoom to happen to fit, their zoom is computed
  // straight from how much vertical space is actually available (see
  // GAME_BOARD_LAYOUT_VERTICAL_PADDING) versus the board's real unscaled
  // height. Full Board keeps its own manual, remembered-per-mode zoom
  // (zoomByMode.full) exactly as before.
  const singleBoardAvailableHeight = Math.max(0, windowHeight - GAME_BOARD_LAYOUT_VERTICAL_PADDING);
  // Floored at the same minimum Full Board's manual slider allows, rather
  // than shrinking all the way toward 0 on an extremely short viewport -
  // body.no-page-scroll still hides whatever that floor can't make fit.
  const autoFitZoom = naturalBoardHeight > 0 ? Math.max(MIN_FULL_BOARD_ZOOM, Math.min(1, singleBoardAvailableHeight / naturalBoardHeight)) : 1;
  const fullBoardZoom = effectiveViewMode === 'full' ? zoomByMode.full : autoFitZoom;
  // Full Board renders actual cards 25% smaller (see styles.css) - a stacked
  // pile's own container is sized from these constants via inline styles
  // (CSS can't reach them), so it has to shrink the same amount or the real
  // card ends up floating in an oversized, empty-looking box around it.
  // Combat forces Full Board regardless of what view you'd picked, but
  // styles.css exempts it from the 25% reduction (legibility matters most
  // exactly when you're deciding blocks) - match that here too, or a
  // stacked creature's container would shrink while the real card inside it doesn't.
  const isFullBoard = effectiveViewMode === 'full' && !showCombatZones;
  const activeCardWidth = isFullBoard ? CARD_WIDTH * 0.75 : CARD_WIDTH;
  const activeCardHeight = isFullBoard ? CARD_HEIGHT * 0.75 : CARD_HEIGHT;
  const activeStackPeekStep = isFullBoard ? STACK_PEEK_STEP * 0.75 : STACK_PEEK_STEP;

  function setFullBoardZoom(next: number | ((current: number) => number)) {
    setZoomByMode((prev) => ({ ...prev, [effectiveViewMode]: typeof next === 'function' ? next(prev[effectiveViewMode]) : next }));
  }

  // Opponent View exists so you can read their side in their own
  // orientation, not to act from - but that's enforced per-action (every
  // drag/attack/block/draw check below already requires !isOpponentSide or
  // soloControl) rather than by a blanket lock, so clicking a card to open
  // its read-only preview still works (see the CardActionsPanel readOnly
  // prop further down). This flag now only drives the "you're just looking"
  // banner and clearing any leftover open panel/selection on the way in.
  const isOpponentViewLocked = effectiveViewMode === 'opponent';

  /**
   * The board content that actually scales with fullBoardZoom - see the
   * ResizeObserver above naturalBoardHeight for why the wrapper needs its
   * own reserved height.
   *
   * Scaling down from a centered origin has a side effect: shrinking a box
   * toward its own middle leaves equal gaps on both sides - on Full Board
   * that meant not reaching the commander/graveyard rails, and on My
   * View/Opponent View (now that their zoom can auto-fit-shrink below 1x
   * too) it meant the library/graveyard corner columns stopping short of the
   * actual screen edges. Setting the unscaled width to 100/zoom% and scaling
   * from the top-LEFT corner instead makes the visible result exactly 100%
   * of the track width at any zoom level - the classic CSS "zoom to fit" trick.
   *
   * My View/Opponent View also get a `minHeight` floor of the full available
   * viewport height - without it, a board with little on it (nothing to
   * shrink-to-fit) would just render at its own short natural size, leaving
   * a gap below instead of reaching the bottom of the screen the way a
   * board that's too tall to fit already does by construction (shrinking
   * exactly to the available height). The floor only ever adds height when
   * natural content falls short of it - a naturally-tall board is
   * unaffected, so the existing shrink-to-fit math above still applies
   * (see naturalBoardHeight/autoFitZoom). .player-zone's `flex: 1` (styles.css)
   * is what actually stretches to fill that extra height rather than
   * leaving it as blank flex space.
   */
  function renderZoomedBoard(children: React.ReactNode) {
    return (
      <div className="game-board-main-zoom-wrapper" style={naturalBoardHeight > 0 ? { height: naturalBoardHeight * fullBoardZoom, overflow: 'hidden' } : undefined}>
        <div
          ref={gameBoardMainRef}
          className="game-board-main"
          style={{
            transform: `scale(${fullBoardZoom})`,
            transformOrigin: 'top left',
            width: `${100 / fullBoardZoom}%`,
            minHeight: effectiveViewMode === 'full' ? undefined : singleBoardAvailableHeight,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!isOpponentViewLocked) return;
    setOpenPanelId(null);
    setOpenZone(null);
    setManaChoiceQueue([]);
    setMultiSelected(new Set());
  }, [isOpponentViewLocked]);

  // Belt-and-suspenders for "My View/Opponent View never scroll": the
  // auto-fit zoom above should already make the single board's wrapper
  // exactly the right height to avoid a scrollbar, but this guarantees it
  // even if some other bit of content (a banner, a future addition) ever
  // pushes the page taller than the viewport. Full Board is left alone -
  // it still uses a manual, page-scrollable zoom.
  useEffect(() => {
    document.body.classList.toggle('no-page-scroll', effectiveViewMode !== 'full');
    return () => document.body.classList.remove('no-page-scroll');
  }, [effectiveViewMode]);

  // Manual zoom only applies to Full Board now - leaving the zoom editor
  // open while switching to an auto-fit view would show controls for a
  // value the board no longer actually uses.
  useEffect(() => {
    if (effectiveViewMode !== 'full') setEditingZoom(false);
  }, [effectiveViewMode]);

  function blockersFor(attackerId: string): string[] {
    if (isDeclaringBlockers) return blockerAssignments[attackerId] || [];
    return state.combatAssignments.find((a) => a.attackerInstanceId === attackerId)?.blockerInstanceIds || [];
  }

  /** True if this card is currently a declared attacker or an assigned
   * blocker - purely a display concern (it moves into the combat zone
   * visually), it's still on the battlefield as far as the rules go. */
  function isInCombatZone(ownerPlayerId: string, instanceId: string): boolean {
    if (ownerPlayerId === state.activePlayerId) {
      if (isDeclaringAttackers && selectedAttackers.has(instanceId)) return true;
      if (state.declaredAttackers.includes(instanceId)) return true;
    } else {
      if (Object.values(blockerAssignments).flat().includes(instanceId)) return true;
      if (state.combatAssignments.some((a) => a.blockerInstanceIds.includes(instanceId))) return true;
    }
    return false;
  }

  function orderedHand(hand: CardInstance[]): CardInstance[] {
    const byId = new Map(hand.map((c) => [c.instanceId, c]));
    const ordered = handOrder.map((id) => byId.get(id)).filter((c): c is CardInstance => !!c);
    const missing = hand.filter((c) => !handOrder.includes(c.instanceId));
    return [...ordered, ...missing];
  }

  function handleHandDrop(playerId: string, targetInstanceId: string) {
    if (!draggedInstanceId || draggedInstanceId === targetInstanceId) return;
    const p = state.players.find((pp) => pp.id === playerId)!;
    const current = orderedHand(p.zones.hand).map((c) => c.instanceId);
    const fromIndex = current.indexOf(draggedInstanceId);
    const toIndex = current.indexOf(targetInstanceId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...current];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, draggedInstanceId);
    setHandOrder(next);
    setDraggedInstanceId(null);
  }

  function orderedRow(playerId: string, rowKey: string, cards: CardInstance[]): CardInstance[] {
    const key = `${playerId}:${rowKey}`;
    const order = boardOrder[key] || [];
    const byId = new Map(cards.map((c) => [c.instanceId, c]));
    const ordered = order.map((id) => byId.get(id)).filter((c): c is CardInstance => !!c);
    const missing = cards.filter((c) => !order.includes(c.instanceId));
    return [...ordered, ...missing];
  }

  function handleRowDrop(playerId: string, rowKey: string, cards: CardInstance[], targetInstanceId: string) {
    if (!draggedInstanceId || draggedInstanceId === targetInstanceId) return;
    const key = `${playerId}:${rowKey}`;
    const current = orderedRow(playerId, rowKey, cards).map((c) => c.instanceId);
    const fromIndex = current.indexOf(draggedInstanceId);
    const toIndex = current.indexOf(targetInstanceId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...current];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, draggedInstanceId);
    setBoardOrder((prev) => ({ ...prev, [key]: next }));
    setDraggedInstanceId(null);
  }

  function enqueueManaChoice(instanceId: string, options: ManaColor[]) {
    setManaChoiceQueue((prev) => [...prev, { instanceId, options }]);
  }

  function resolveManaChoice(color: ManaColor) {
    const [current, ...rest] = manaChoiceQueue;
    if (!current) return;
    onAction({ type: 'TOGGLE_TAP', instanceId: current.instanceId, chosenColor: color });
    setManaChoiceQueue(rest);
  }

  function cancelManaChoice() {
    setManaChoiceQueue((prev) => prev.slice(1));
  }

  /** Is this permanent a legal choice for the ability currently waiting on a
   * target? See engine/combat.ts: isLegalPendingTarget (shared with the
   * local VS AI's own targeting in useLocalGame.ts) for the actual rules -
   * this just supplies the visibility-gated pendingTargetForYou instead of
   * the raw (possibly not-yours-to-see) state.pendingTarget. */
  function isLegalPendingTarget(card: CardInstance, ownerId: string): boolean {
    if (!pendingTargetForYou) return false;
    return isLegalPendingTargetShared(state, pendingTargetForYou, card, ownerId);
  }

  /** Is this permanent a legal choice for Yuna, Grand Summoner's queued
   * "put N +1/+1 counters on target creature" prompt? A separate mechanism
   * from pendingTarget entirely (see GameState.pendingCounterTransferQueue's
   * own comment) - any creature, either player's, same as the real card's
   * unrestricted "target creature." */
  function isLegalCounterTransferTarget(card: CardInstance): boolean {
    if (!pendingCounterTransferForYou) return false;
    return getCardDefinition(card.defId).type === 'creature';
  }

  /** Is this permanent a legal target for the Equip/Attach button's pending
   * pick (see pendingAttach)? Mirrors engine/actions.ts: attachCard's own
   * legality checks (same-controller-only for Equipment, no hexproof, can't
   * target itself) so nothing gets offered here that the server would then
   * reject. */
  function isLegalAttachTarget(card: CardInstance, ownerId: string): boolean {
    if (!pendingAttach) return false;
    if (card.instanceId === pendingAttach.instanceId) return false;
    const def = getCardDefinition(card.defId);
    if (def.type !== 'creature') return false;
    const equipDef = getCardDefinition(findCard(state, pendingAttach.instanceId)!.card.defId);
    if (!!equipDef.equipCost && ownerId !== pendingAttach.ownerId) return false;
    if (!!equipDef.equipCost && hasKeyword(def, 'hexproof')) return false;
    return true;
  }

  /** Is this permanent a legal choice for a pendingSacrifice waiting on
   * ownerId (e.g. Cornered by Black Mages, Gaius van Baelsar) - unlike
   * isLegalPendingTarget, ownerId must be the player who has to sacrifice,
   * choosing among their OWN permanents, not the caster picking something
   * of the opponent's. */
  function isLegalSacrifice(card: CardInstance, ownerId: string): boolean {
    if (!pendingSacrificeForYou) return false;
    if (pendingSacrificeForYou.remainingPlayerIds[0] !== ownerId) return false;
    if (ownerId !== yourPlayerId && !soloControl) return false;
    const def = getCardDefinition(card.defId);
    const filter = pendingSacrificeForYou.filter;
    if (filter === 'creature') return def.type === 'creature';
    if (filter === 'creatureToken') return def.type === 'creature' && !!card.isToken;
    if (filter === 'nontokenCreature') return def.type === 'creature' && !card.isToken;
    return def.type === 'enchantment';
  }

  /** Is this creature a legal pick for pendingKeepOneSacrificeRestForYou -
   * the front-queue player's OWN creature (any of them; picking it keeps it
   * and sacrifices the rest, see CHOOSE_KEEP_ONE_SACRIFICE_REST). */
  function isLegalKeepOneChoice(card: CardInstance, ownerId: string): boolean {
    if (!pendingKeepOneSacrificeRestForYou) return false;
    if (pendingKeepOneSacrificeRestForYou.remainingPlayerIds[0] !== ownerId) return false;
    if (ownerId !== yourPlayerId && !soloControl) return false;
    return getCardDefinition(card.defId).type === 'creature';
  }

  /** Is this permanent a legal pick for an ability's sacrificeAnother cost
   * currently awaiting a click (e.g. Ahriman's "3, Sacrifice another
   * creature or artifact: Draw a card.", or The Gold Saucer's "Sacrifice two
   * artifacts") - must be another permanent the SAME controller controls,
   * matching the ability's cost filter, and not already picked (relevant
   * once count > 1 - see pendingSacrificeCost.selected). */
  function isLegalSacrificeCostChoice(card: CardInstance, ownerId: string): boolean {
    if (!pendingSacrificeCost) return false;
    if (ownerId !== pendingSacrificeCost.ownerId) return false;
    if (card.instanceId === pendingSacrificeCost.instanceId) return false;
    if (pendingSacrificeCost.selected.includes(card.instanceId)) return false;
    const def = getCardDefinition(card.defId);
    if (pendingSacrificeCost.filter === 'artifactOrCreature') return def.type === 'artifact' || def.type === 'creature';
    if (pendingSacrificeCost.filter === 'nonlandPermanent') return def.type !== 'land';
    return def.type === pendingSacrificeCost.filter;
  }

  /** Click handler for isLegalSacrificeCostChoice - adds `instanceId` to the
   * running selection and, once it reaches the ability's required count,
   * fires the single atomic ACTIVATE_ABILITY dispatch and clears
   * pendingSacrificeCost. For the common count-1 case (e.g. Ahriman) this
   * dispatches immediately on the first click, same as before count > 1
   * (The Gold Saucer's "Sacrifice two artifacts") existed. */
  function handleSacrificeCostClick(instanceId: string) {
    setPendingSacrificeCost((prev) => {
      if (!prev) return prev;
      const selected = [...prev.selected, instanceId];
      if (selected.length >= prev.count) {
        onAction({ type: 'ACTIVATE_ABILITY', instanceId: prev.instanceId, abilityId: prev.abilityId, costTargetInstanceIds: selected });
        return null;
      }
      return { ...prev, selected };
    });
  }

  /** Is this permanent a legal pick for pendingCounterRemovalCost - a
   * nonland permanent the SAME controller controls with at least one
   * counter on it already (any label; which one actually gets removed is
   * auto-picked server-side - see CardAbility.cost.removeCounterFromAnotherPermanent). */
  function isLegalCounterRemovalCostChoice(card: CardInstance, ownerId: string): boolean {
    if (!pendingCounterRemovalCost) return false;
    if (ownerId !== pendingCounterRemovalCost.ownerId) return false;
    if (getCardDefinition(card.defId).type === 'land') return false;
    return card.counters.length > 0;
  }

  /** Click handler for isLegalCounterRemovalCostChoice - always a single
   * pick, so it dispatches immediately. */
  function handleCounterRemovalCostClick(instanceId: string) {
    setPendingCounterRemovalCost((prev) => {
      if (!prev) return prev;
      onAction({ type: 'ACTIVATE_ABILITY', instanceId: prev.instanceId, abilityId: prev.abilityId, costTargetInstanceIds: [instanceId] });
      return null;
    });
  }

  /** Is this permanent a legal pick for pendingEscalateCost's running
   * selection - an untapped creature the same controller controls, not
   * already picked. */
  function isLegalEscalateCostChoice(card: CardInstance, ownerId: string): boolean {
    if (!pendingEscalateCost) return false;
    if (ownerId !== pendingEscalateCost.ownerId) return false;
    if (card.tapped) return false;
    if (pendingEscalateCost.selected.includes(card.instanceId)) return false;
    return getCardDefinition(card.defId).type === 'creature';
  }

  /** Click handler for isLegalEscalateCostChoice - once `selected` reaches
   * the required count, fires the actual CAST_CARD (carrying the
   * already-chosen chosenModeIndices along) and clears pendingEscalateCost. */
  function handleEscalateCostClick(instanceId: string) {
    setPendingEscalateCost((prev) => {
      if (!prev) return prev;
      const selected = [...prev.selected, instanceId];
      if (selected.length >= prev.count) {
        onAction({ type: 'CAST_CARD', instanceId: prev.instanceId, chosenModeIndices: prev.chosenModeIndices, escalateCostInstanceIds: selected });
        return null;
      }
      return { ...prev, selected };
    });
  }

  /** Is this permanent a legal (untapped, other, actual creature) pick to
   * add to the running Crew selection? See pendingCrew - clicking a card
   * that already matches toggles it back off instead. */
  function isLegalCrewChoice(card: CardInstance, ownerId: string): boolean {
    if (!pendingCrew) return false;
    if (ownerId !== pendingCrew.ownerId) return false;
    if (card.instanceId === pendingCrew.instanceId) return false;
    if (card.tapped && !pendingCrew.selected.includes(card.instanceId)) return false;
    return getCardDefinition(card.defId).type === 'creature';
  }

  /** Is this permanent a legal pick to add to the running Convoke selection?
   * See pendingConvokeCast - clicking a card that already matches toggles it
   * back off instead. */
  function isLegalConvokeChoice(card: CardInstance, ownerId: string): boolean {
    if (!pendingConvokeCast) return false;
    if (ownerId !== pendingConvokeCast.ownerId) return false;
    if (card.tapped && !pendingConvokeCast.selected.includes(card.instanceId)) return false;
    return getCardDefinition(card.defId).type === 'creature';
  }

  /** A permanent's own producesMana, or - if it doesn't have one - whatever a
   * grantsManaAbilityToOthers permanent (e.g. A Realm Reborn) the SAME
   * controller controls is handing out to everything else. Mirrors
   * engine/actions.ts's effectiveProducesMana exactly. */
  function grantedManaAbility(instance: CardInstance): ManaColor | 'any' | ManaColor[] | undefined {
    const owner = state.players.find((p) => p.id === instance.ownerId);
    if (!owner) return undefined;
    const granter = owner.zones.battlefield.find((c) => c.instanceId !== instance.instanceId && !!getCardDefinition(c.defId).grantsManaAbilityToOthers);
    return granter ? getCardDefinition(granter.defId).grantsManaAbilityToOthers : undefined;
  }

  /** def.producesMana (or a granted mana ability), fully expanded into a
   * concrete ManaColor[] - resolves 'commanderColorIdentity' against the
   * controller's actual commander (see engine/actions.ts: toggleTap's own
   * resolution, mirrored here for the UI) and 'any'/array/single-color into
   * their real color lists. Never includes CardDefinition.altProducesMana -
   * callers that care about the "pain land" alt colors add those in themselves. */
  function resolvedPrimaryManaColors(def: CardDefinition, instance: CardInstance): ManaColor[] {
    let producesMana = def.producesMana ?? grantedManaAbility(instance);
    if (producesMana === 'commanderColorIdentity') {
      const owner = state.players.find((p) => p.id === instance.ownerId);
      const commanderDef = owner?.commanderDefId ? getCardDefinition(owner.commanderDefId) : null;
      const identity = commanderDef ? ([...new Set(Object.keys(parseCostLabel(commanderDef.costLabel).colors))] as ManaColor[]) : [];
      producesMana = identity.length > 1 ? identity : identity.length === 1 ? identity[0] : 'C';
    }
    if (producesMana === 'opponentLandColors') {
      // Mirrors engine/actions.ts: toggleTap's own opponentLandColors
      // resolution (see that function's doc comment for the full reasoning).
      const opponent = state.players.find((p) => p.id !== instance.ownerId);
      const colors = new Set<ManaColor>();
      for (const c of opponent?.zones.battlefield ?? []) {
        const d = getCardDefinition(c.defId);
        if (d.type !== 'land') continue;
        if (d.producesMana === 'any') ALL_MANA_COLORS.forEach((x) => colors.add(x));
        else if (Array.isArray(d.producesMana)) d.producesMana.forEach((x) => colors.add(x));
        else if (d.producesMana && d.producesMana !== 'commanderColorIdentity' && d.producesMana !== 'opponentLandColors' && d.producesMana !== 'ownLandColors') colors.add(d.producesMana);
        if (d.altProducesMana) d.altProducesMana.colors.forEach((x) => colors.add(x));
      }
      colors.delete('C');
      const union = [...colors];
      producesMana = union.length > 1 ? union : union.length === 1 ? union[0] : 'C';
    }
    if (producesMana === 'ownLandColors') {
      // Mirrors engine/actions.ts: toggleTap's own ownLandColors resolution -
      // the controller's-own-lands mirror of opponentLandColors above.
      const owner = state.players.find((p) => p.id === instance.ownerId);
      const colors = new Set<ManaColor>();
      for (const c of owner?.zones.battlefield ?? []) {
        const d = getCardDefinition(c.defId);
        if (d.type !== 'land') continue;
        if (d.producesMana === 'any') ALL_MANA_COLORS.forEach((x) => colors.add(x));
        else if (Array.isArray(d.producesMana)) d.producesMana.forEach((x) => colors.add(x));
        else if (d.producesMana && d.producesMana !== 'commanderColorIdentity' && d.producesMana !== 'opponentLandColors' && d.producesMana !== 'ownLandColors') colors.add(d.producesMana);
        if (d.altProducesMana) d.altProducesMana.colors.forEach((x) => colors.add(x));
      }
      colors.delete('C');
      const union = [...colors];
      producesMana = union.length > 1 ? union : union.length === 1 ? union[0] : 'C';
    }
    return !producesMana ? [] : Array.isArray(producesMana) ? producesMana : producesMana === 'any' ? ALL_MANA_COLORS : [producesMana];
  }

  /** The color choices an untapped mana source offers, or null if it only
   * ever makes one color. Not land-specific - a mana creature like Goobbue
   * Gardener ("Tap: Add G.") uses the exact same producesMana field. */
  function manaTapOptions(def: CardDefinition, instance: CardInstance): ManaColor[] | null {
    const primary = resolvedPrimaryManaColors(def, instance);
    // "Pain land" alt mode (Brushland: "{T}: Add {C}." / "{T}: Add {G} or {W}.
    // This deals 1 damage to you.") offers its colors alongside the primary
    // one, all as a single combined choice - mirrors toggleTap's resolution.
    const combined = [...new Set([...primary, ...(def.altProducesMana?.colors ?? [])])];
    return combined.length > 1 ? combined : null;
  }

  /**
   * What to show as clickable pips under an untapped mana source - unlike
   * manaTapOptions (which is only about *ambiguous* choices needing a
   * prompt), this also covers a plain single-color source: one pip, click
   * it, tapped - no popup, no double-click needed. Keep this one scoped to
   * the pip UI itself; handleToggleTap/batch stack tapping still use
   * manaTapOptions so a single-color source in a stack keeps tapping in one step.
   */
  function manaPipOptions(def: CardDefinition, instance: CardInstance): ManaColor[] | null {
    const ambiguous = manaTapOptions(def, instance);
    if (ambiguous) return ambiguous;
    const primary = resolvedPrimaryManaColors(def, instance);
    return primary.length === 1 ? primary : null;
  }

  /** Why the Tap/Untap button in CardActionsPanel should be disabled for this
   * card right now, or null if pressing it is currently legal - mirrors
   * engine/actions.ts: toggleTap's own validation exactly (mutual adjustment
   * always allows it; untapping needs unspent mana it was tapped for;
   * tapping a summoning-sick mana creature isn't allowed), just precomputed
   * here so the button can be grayed out instead of failing after a click. */
  function tapDisabledReason(def: CardDefinition, instance: CardInstance, owner: PlayerState): string | null {
    if (mutualActive) return null;
    if (state.pendingManaColorChoice?.instanceId === instance.instanceId) return 'Choose a mana color for this permanent first';
    if (instance.tapped) {
      if (!instance.producedManaColor) return "This permanent isn't tapped for mana - it'll untap automatically at your next untap step";
      // Ring of the Lucii's "T: Add MM" produces (and so must refund in
      // full) 2 colorless from one tap - everything else defaults to 1.
      if (owner.manaPool[instance.producedManaColor] < (def.producesManaAmount ?? 1)) return 'Its mana has already been spent';
      return null;
    }
    const producesMana = !!(def.producesMana ?? grantedManaAbility(instance));
    if (def.type === 'creature' && producesMana && instance.summoningSick) return "This creature has summoning sickness and can't tap for mana yet";
    // Tapping a permanent with no mana ability does nothing at all - it's not
    // how attacking works (that's its own declare-attackers flow) and it's
    // not how a {T}-cost ability's cost is paid (ACTIVATE_ABILITY handles
    // that itself). Manually tapping it here would just be a pointless
    // "tapped for no reason" state with no way back except waiting for the
    // untap step.
    if (!producesMana) return 'Tapping this has no effect - it has no mana ability';
    return null;
  }

  /** Whether CardActionsPanel's plain Tap/Untap row should exist AT ALL for
   * this card - a structural check (does it have a mana ability, printed or
   * granted, in the first place), unlike tapDisabledReason's reasons (mana
   * already spent, summoning sickness, ...), which are all TEMPORARY - the
   * ability is real, just not usable this instant. A card with no mana
   * ability ever shows no tap row at all; one that has it but is
   * temporarily blocked still shows the row (see CardActionsPanel's
   * card-action-button-ready/-notready), just disabled for now. */
  function hasPlainTapUse(def: CardDefinition, instance: CardInstance): boolean {
    return !!(def.producesMana ?? grantedManaAbility(instance));
  }

  function handleToggleTap(card: CardInstance) {
    const def = getCardDefinition(card.defId);
    if (!card.tapped) {
      const options = manaTapOptions(def, card);
      if (options) {
        enqueueManaChoice(card.instanceId, options);
        return;
      }
    }
    onAction({ type: 'TOGGLE_TAP', instanceId: card.instanceId });
  }

  /** Gates every direct tap/untap interaction on the battlefield (double-click,
   * mana pips, the stacked-pile tap/untap stepper, box-select's Tap button) -
   * a card someone else controls only ever changes because the rules say
   * so, never because another player (or, in solo VS AI, the human) reached
   * over and tapped or untapped it themselves. That's true in real
   * multiplayer (no griefing) and just as true in VS AI - the AI plays its
   * own turn through useLocalGame's own dispatches, so soloControl is NOT
   * an exception here; a manual-tap door into its cards would just be a way
   * to cheat against it. Mutual Adjustment is the one deliberate exception:
   * both players explicitly agreed to suspend this. */
  function canControlCard(ownerId: string): boolean {
    return ownerId === yourPlayerId || mutualActive;
  }

  const CONCEDE_HOLD_MS = 3000;

  /** Concede ends the game the instant it fires, so a plain click was one
   * misclick away from throwing a game - holding for a few seconds (with the
   * red bar filling to show how close it is) means letting go early always
   * cancels harmlessly, and only an actually-held press gets there. */
  function startConcedeHold() {
    if (concedeTimerRef.current) return;
    setConcedeHolding(true);
    concedeTimerRef.current = setTimeout(() => {
      concedeTimerRef.current = null;
      setConcedeHolding(false);
      onAction({ type: 'CONCEDE' }, yourPlayerId);
    }, CONCEDE_HOLD_MS);
  }

  function cancelConcedeHold() {
    if (concedeTimerRef.current) {
      clearTimeout(concedeTimerRef.current);
      concedeTimerRef.current = null;
    }
    setConcedeHolding(false);
  }

  useEffect(() => () => cancelConcedeHold(), []);

  /**
   * A stack of 2+ identical permanents is tapped/untapped a chosen amount at
   * a time via the stepper below the pile (not by clicking the pile itself) -
   * that keeps exactly which instances get toggled unambiguous, so the right
   * amount of mana is added or refunded each time instead of guessing from a click target.
   */
  function tapNFromGroup(group: CardInstance[], n: number) {
    group
      .filter((g) => !g.tapped)
      .slice(0, n)
      .forEach((c) => handleToggleTap(c));
  }

  function untapNFromGroup(group: CardInstance[], n: number, manaPool: Record<ManaColor, number>) {
    untappableCardsInGroup(group, manaPool)
      .slice(0, n)
      .forEach((c) => handleToggleTap(c));
  }

  /** Stacked dual/any-color lands tap one at a time, picking the color right
   * there via the stack's own pips - no ambiguity to prompt about, so this
   * goes straight to TOGGLE_TAP instead of through handleToggleTap's
   * enqueueManaChoice detour. */
  function tapOneFromGroupWithColor(group: CardInstance[], color: ManaColor) {
    const card = group.find((g) => !g.tapped);
    if (!card) return;
    onAction({ type: 'TOGGLE_TAP', instanceId: card.instanceId, chosenColor: color });
  }

  /** Which colors are actually sitting tapped-and-unspent in this stack
   * right now - the untap side's pips only ever show these, never the
   * land's other color(s), since there's nothing of those to refund yet. */
  function untapColorOptionsForGroup(group: CardInstance[], manaPool: Record<ManaColor, number>): ManaColor[] {
    const colors = new Set<ManaColor>();
    for (const c of untappableCardsInGroup(group, manaPool)) {
      if (c.producedManaColor) colors.add(c.producedManaColor);
    }
    return Array.from(colors);
  }

  function untapOneFromGroupWithColor(group: CardInstance[], color: ManaColor, manaPool: Record<ManaColor, number>) {
    const card = untappableCardsInGroup(group, manaPool).find((c) => c.producedManaColor === color);
    if (card) handleToggleTap(card);
  }

  function handleBoardDrop(playerId: string) {
    if (!draggedInstanceId) return;
    // A blocker can only ever be dropped onto an existing card via the
    // per-card handlers in renderCreatureCard (acceptsBlockerRemoval) - if
    // it's your only untapped/visible creature, or you're changing your
    // mind about your last remaining blocker, the row it belongs in can be
    // empty with nothing there to drop onto. Falling back to the whole
    // zone here means the drop still lands even then. Only ever removes an
    // instance that's actually currently assigned as a blocker, so this
    // never interferes with dropping a hand card to cast it below.
    if (isDeclaringBlockers && playerId === yourPlayerId && Object.values(blockerAssignments).some((ids) => ids.includes(draggedInstanceId!))) {
      removeBlockerAssignmentById(draggedInstanceId);
      setDraggedInstanceId(null);
      return;
    }
    // Same fallback for attackers - dragging one back onto its owner's board
    // only has an existing card to land on (acceptsAttackerRemoval, in
    // renderCreatureCard) if some OTHER creature is still sitting in that
    // row. Attack with your whole board (or your only creature) and that
    // row is empty for the rest of declare_attackers, so the drop would
    // otherwise have nowhere to land at all.
    if (isDeclaringAttackers && (playerId === yourPlayerId || !!soloControl) && selectedAttackers.has(draggedInstanceId)) {
      removeAttacker(draggedInstanceId);
      setDraggedInstanceId(null);
      return;
    }
    const found = findCard(state, draggedInstanceId);
    if (!found) return;
    if (found.player.id !== playerId) return;
    if (found.zone === 'hand' || found.zone === 'commander') {
      setPendingCastConfirm(found.card);
    }
    setDraggedInstanceId(null);
  }

  function handleCast(card: CardInstance) {
    const def = getCardDefinition(card.defId);
    if (def.chooseModes && def.chooseModes.length > 0) {
      setPendingModalCast(card);
      return;
    }
    if (def.tieredModes && def.tieredModes.length > 0) {
      setPendingTieredCast(card);
      return;
    }
    if (def.kicker) {
      setPendingKickerCast(card);
      return;
    }
    if (def.convoke) {
      setPendingConvokeCast({ instanceId: card.instanceId, ownerId: card.ownerId, selected: [] });
      return;
    }
    const parsed = parseCostLabel(def.costLabel);
    let chosenX: number | undefined;
    if (parsed.hasX) {
      const value = window.prompt(`Choose a value for X (${def.name}):`, '0');
      chosenX = parseInt(value ?? '0', 10) || 0;
    }
    onAction({ type: 'CAST_CARD', instanceId: card.instanceId, chosenX });
    setOpenPanelId(null);
  }

  function toggleAttacker(instanceId: string) {
    setSelectedAttackers((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  }

  function addAttackerFromDrag(instanceId: string) {
    setSelectedAttackers((prev) => new Set(prev).add(instanceId));
  }

  function removeAttacker(instanceId: string) {
    setSelectedAttackers((prev) => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });
  }

  function confirmAttackers() {
    onAction({ type: 'DECLARE_ATTACKERS', instanceIds: Array.from(selectedAttackers) }, state.activePlayerId);
    setSelectedAttackers(new Set());
  }

  /** Assigns a blocker to an attacker, removing it from any other attacker
   * it might currently be assigned to first - a creature can only block
   * one attacker at a time. */
  function assignBlocker(attackerInstanceId: string, blockerInstanceId: string) {
    setBlockerAssignments((prev) => {
      const next: Record<string, string[]> = {};
      for (const [atkId, blockers] of Object.entries(prev)) {
        next[atkId] = blockers.filter((id) => id !== blockerInstanceId);
      }
      next[attackerInstanceId] = [...(next[attackerInstanceId] || []), blockerInstanceId];
      return next;
    });
  }

  function removeBlockerAssignment(attackerInstanceId: string, blockerInstanceId: string) {
    setBlockerAssignments((prev) => ({
      ...prev,
      [attackerInstanceId]: (prev[attackerInstanceId] || []).filter((id) => id !== blockerInstanceId),
    }));
  }

  /** For dragging an already-assigned blocker back out to change your mind -
   * a blocker only ever blocks one attacker, so its current assignment can
   * be found without the caller having to already know which attacker it's on. */
  function removeBlockerAssignmentById(blockerInstanceId: string) {
    const attackerId = Object.keys(blockerAssignments).find((atkId) => blockerAssignments[atkId].includes(blockerInstanceId));
    if (attackerId) removeBlockerAssignment(attackerId, blockerInstanceId);
  }

  function handleAttackerClickForBlocking(attackerInstanceId: string) {
    if (!pendingBlocker) return;
    assignBlocker(attackerInstanceId, pendingBlocker);
    setPendingBlocker(null);
  }

  function handleBlockerCandidateClick(instanceId: string) {
    setPendingBlocker(instanceId === pendingBlocker ? null : instanceId);
  }

  function confirmBlockers() {
    const assignments = Object.entries(blockerAssignments).map(([attackerInstanceId, blockerInstanceIds]) => ({ attackerInstanceId, blockerInstanceIds }));
    const defenderId = state.players.find((p) => p.id !== state.activePlayerId)!.id;
    onAction({ type: 'DECLARE_BLOCKERS', assignments }, defenderId);
    setBlockerAssignments({});
    setPendingBlocker(null);
  }

  function startSelection(e: React.MouseEvent, enabled: boolean) {
    if (!enabled) return;
    if ((e.target as HTMLElement).closest('.card')) return;
    setSelectionBox({ startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, w: 0, h: 0 });
  }

  function updateSelection(e: React.MouseEvent) {
    setSelectionBox((box) => {
      if (!box) return box;
      const x = Math.min(box.startX, e.clientX);
      const y = Math.min(box.startY, e.clientY);
      return { ...box, x, y, w: Math.abs(e.clientX - box.startX), h: Math.abs(e.clientY - box.startY) };
    });
  }

  function finishSelection() {
    setSelectionBox((box) => {
      if (box && (box.w > 4 || box.h > 4)) {
        const hits = new Set<string>();
        cardRefs.current.forEach((el, id) => {
          const r = el.getBoundingClientRect();
          if (r.left < box.x + box.w && r.right > box.x && r.top < box.y + box.h && r.bottom > box.y) {
            // cardRefs spans every card on screen regardless of owner - in
            // Full Board a drag can start on your own side (where it's
            // enabled) and cross into the opponent's, so this still has to
            // filter opponent cards back out itself rather than trusting
            // startSelection's own-zone check alone.
            const owner = findCard(state, id)?.player.id;
            if (owner && canControlCard(owner)) hits.add(id);
          }
        });
        setMultiSelected(hits);
      }
      return null;
    });
  }

  function tapMultiSelected() {
    for (const id of multiSelected) {
      const found = findCard(state, id);
      if (!found || found.zone !== 'battlefield' || found.card.tapped) continue;
      const def = getCardDefinition(found.card.defId);
      const options = manaTapOptions(def, found.card);
      if (options) {
        enqueueManaChoice(id, options);
      } else {
        onAction({ type: 'TOGGLE_TAP', instanceId: id });
      }
    }
    setMultiSelected(new Set());
  }

  function registerCardRef(id: string, el: HTMLDivElement | null) {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }

  function registerLandsRowRef(playerId: string, el: HTMLDivElement | null) {
    if (el) landsRowRefs.current.set(playerId, el);
    else landsRowRefs.current.delete(playerId);
  }

  // If you open an instant/flash card mid-combat and can't yet pay for it,
  // pan down to your lands so you can go tap what you need before coming
  // back to actually cast it - you can't play it without paying the cost.
  useEffect(() => {
    if (!openPanelId) return;
    const combatPhase = state.phase === 'declare_attackers' || state.phase === 'declare_blockers' || state.phase === 'combat_damage' || state.phase === 'combat_end';
    if (!combatPhase) return;
    const found = findCard(state, openPanelId);
    if (!found || found.zone !== 'hand') return;
    const def = getCardDefinition(found.card.defId);
    const isInstantSpeed = def.type === 'instant' || hasKeyword(def, 'flash');
    if (!isInstantSpeed) return;
    if (canPay(found.player.manaPool, effectiveCastCost(def, found.player, state.players.find((p) => p.id !== found.player.id)), 0)) return;
    landsRowRefs.current.get(found.player.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Deliberately only re-runs when a new panel opens, not on every state
    // tick while it's open (e.g. mana pool changes from tapping) - otherwise
    // this would keep re-centering and fighting the player's own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanelId]);

  function startPhaseDrag(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    phaseDragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    window.addEventListener('mousemove', onPhaseDragMove);
    window.addEventListener('mouseup', onPhaseDragEnd);
  }

  function onPhaseDragMove(e: MouseEvent) {
    if (!phaseDragRef.current) return;
    setPhaseBoxPos({ x: e.clientX - phaseDragRef.current.offsetX, y: e.clientY - phaseDragRef.current.offsetY });
  }

  function onPhaseDragEnd() {
    phaseDragRef.current = null;
    window.removeEventListener('mousemove', onPhaseDragMove);
    window.removeEventListener('mouseup', onPhaseDragEnd);
  }

  /**
   * Renders a group as either a single Card (group of 1) or a real pile of
   * layered Cards - one per instance, each showing its own tapped state, so
   * a stack visibly fills up with tapped (rotated) copies at the back as you
   * use them. `front` is whichever instance is interactive (gets the click
   * handlers); the rest are non-interactive layers peeking out behind it,
   * with untapped ones kept nearer the front and tapped ones sinking furthest back.
   */
  function renderStackedCard(
    group: CardInstance[],
    front: CardInstance,
    frontProps: { selected?: boolean; onClick: () => void },
    canControl: boolean,
  ) {
    if (group.length === 1) {
      const def = getCardDefinition(front.defId);
      const pipOptions = manaPipOptions(def, front);
      if (!pipOptions) {
        // No mana ability at all - tapping this would do nothing, so the
        // only way to tap/untap it is the panel's Tap button (which
        // disables itself with a reason when that wouldn't do anything
        // either - see tapDisabledReason). Deliberately no onDoubleClick
        // here anymore: it used to quick-toggle tap as a side effect of
        // double-clicking to open the panel and read the card, which both
        // tapped things by accident and let you "tap" a card with no tap
        // effect for no reason at all.
        return (
          <Card
            definition={def}
            instance={front}
            {...frontProps}
            staticBuff={activeStatBadge(def, front, state)}
            transformReady={canTransformNow(def, front, state)}
            revealOutline={revealOutlineFor(state, front)}
            awaitingOptionalChoice={awaitingOptionalPayLife(state, front)}
          />
        );
      }

      // Untapped: show every color this land could produce - click one to
      // tap for that color. Tapped: show only the one it actually produced,
      // greyed/transparent, so untapping (and then picking a color again if
      // it has more than one) is still just a click away instead of needing
      // the panel - it just never shows a color that isn't currently either
      // choosable or the one actually in play.
      // !canControl forces this into the same "single-click just opens the
      // panel" path a dual/any-color land already uses, whatever the actual
      // color count - the pips below stay visible for information but stop
      // doing anything, so someone else's land can't be tapped this way either.
      const isSingleColor = canControl && pipOptions.length === 1;
      const displayedPips = front.tapped ? (front.producedManaColor ? [front.producedManaColor] : []) : pipOptions;

      function doToggle(color: ManaColor) {
        if (front.tapped) handleToggleTap(front);
        else onAction({ type: 'TOGGLE_TAP', instanceId: front.instanceId, chosenColor: color });
      }

      // Single-color lands are unambiguous either way, so the card itself
      // becomes a second way to tap/untap - that reuses the click frontProps
      // would otherwise spend opening the panel, so that moves to
      // double-click instead. A dual/any-color land keeps single-click
      // opening the panel as normal (there's a real color choice to make,
      // so the pips are the deliberate way to act).
      const cardEl = (
        <Card
          definition={def}
          instance={front}
          selected={frontProps.selected}
          onClick={isSingleColor ? () => doToggle(pipOptions[0]) : frontProps.onClick}
          onDoubleClick={isSingleColor ? frontProps.onClick : undefined}
          transformReady={canTransformNow(def, front, state)}
          revealOutline={revealOutlineFor(state, front)}
          awaitingOptionalChoice={awaitingOptionalPayLife(state, front)}
        />
      );
      if (displayedPips.length === 0) return cardEl;
      return (
        <div className="battlefield-card-with-pips">
          {cardEl}
          <div className="battlefield-mana-pips">
            {displayedPips.map((color) => (
              <button
                key={color}
                className={`mana-tap-pip mana-${color} ${front.tapped ? 'mana-tap-pip-spent' : ''}`}
                title={canControl ? (front.tapped ? `Untap (refund ${color})` : `Tap for ${color}`) : color}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canControl) return;
                  doToggle(color);
                }}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      );
    }
    const behind = group.filter((g) => g.instanceId !== front.instanceId);
    const depthOrder = [...behind.filter((g) => !g.tapped), ...behind.filter((g) => g.tapped)];
    const footprint = Math.min(depthOrder.length, STACK_PEEK_MAX_LAYERS) * activeStackPeekStep;
    const tappedCount = group.filter((g) => g.tapped).length;
    const untappedCount = group.length - tappedCount;
    const ownerManaPool = state.players.find((p) => p.id === group[0].ownerId)!.manaPool;
    const untappableCount = untappableCardsInGroup(group, ownerManaPool).length;
    return (
      <div className="battlefield-stack" style={{ width: activeCardWidth + footprint, height: activeCardHeight + footprint + STACK_CONTROL_HEIGHT }}>
        {depthOrder.map((bc, i) => {
          const depth = Math.min(i + 1, STACK_PEEK_MAX_LAYERS) * activeStackPeekStep;
          return (
            <div
              key={bc.instanceId}
              className="battlefield-stack-layer battlefield-stack-layer-back"
              style={{ transform: `translate(${depth}px, ${depth}px)`, zIndex: depthOrder.length - i }}
            >
              <Card
                definition={getCardDefinition(bc.defId)}
                instance={bc}
                staticBuff={activeStatBadge(getCardDefinition(bc.defId), bc, state)}
                transformReady={canTransformNow(getCardDefinition(bc.defId), bc, state)}
                revealOutline={revealOutlineFor(state, bc)}
                awaitingOptionalChoice={awaitingOptionalPayLife(state, bc)}
              />
            </div>
          );
        })}
        {/* Stacked permanents are only tapped/untapped via this control strip,
            a chosen amount at a time, so it's always unambiguous which
            copies - and how much mana - is being added or refunded. Omitted
            entirely (rather than just disabled) when you don't control this
            stack - there's nothing here worth showing if it can't be used. */}
        {canControl && (
          <div style={{ position: 'absolute', top: activeCardHeight + footprint, left: 0, width: activeCardWidth + footprint, zIndex: depthOrder.length + 2 }}>
            <StackTapControls
              untappedCount={untappedCount}
              untappableCount={untappableCount}
              onTapN={(n) => tapNFromGroup(group, n)}
              onUntapN={(n) => untapNFromGroup(group, n, ownerManaPool)}
              tapColorOptions={manaPipOptions(getCardDefinition(front.defId), front) ?? undefined}
              onTapColor={(color) => tapOneFromGroupWithColor(group, color)}
              untapColorOptions={untapColorOptionsForGroup(group, ownerManaPool)}
              onUntapColor={(color) => untapOneFromGroupWithColor(group, color, ownerManaPool)}
            />
          </div>
        )}
        <div className="battlefield-stack-layer" style={{ zIndex: depthOrder.length + 1 }}>
          <Card
            definition={getCardDefinition(front.defId)}
            instance={front}
            selected={frontProps.selected}
            onClick={frontProps.onClick}
            staticBuff={activeStatBadge(getCardDefinition(front.defId), front, state)}
            transformReady={canTransformNow(getCardDefinition(front.defId), front, state)}
            revealOutline={revealOutlineFor(state, front)}
            awaitingOptionalChoice={awaitingOptionalPayLife(state, front)}
          />
        </div>
      </div>
    );
  }

  function renderCreatureCard(group: CardInstance[], isOpponentSide: boolean, rowCards: CardInstance[], ownerId: string) {
    const stackCount = group.length;
    // Prefer showing a copy that's actually usable right now (ready to attack/block),
    // so clicking a stack does the useful thing instead of a coin-flip instance.
    const c = group.find((g) => !g.tapped && !g.summoningSick) ?? group.find((g) => !g.tapped) ?? group[0];
    const isDead = state.pendingDeaths.includes(c.instanceId);
    const canControl = canControlCard(ownerId) || !!soloControl;
    // Equipment/Auras attached to this creature stack literally underneath it
    // (see below) - pulled out of the `others` row by splitBattlefield so
    // they don't ALSO show up floating there.
    const attachedEquipment =
      stackCount === 1 ? state.players.find((p) => p.id === ownerId)?.zones.battlefield.filter((x) => x.attachedToInstanceId === c.instanceId) ?? [] : [];
    // Whether this creature's OWNER is the attacking (vs defending) side of
    // combat right now - based on state.activePlayerId, not the isOpponentSide
    // visual/layout flag, which only happens to line up with it for the
    // DEFENDER's own view in a real 2-player game. Under soloControl the same
    // person plays both sides, so isOpponentSide alone can't tell attacker
    // from defender - without this, declaring blockers for the AI's side
    // while you were the attacker (isOpponentSide there being true from
    // your board's perspective) had no way to ever select a blocker at all,
    // getting combat stuck with nothing to click.
    const isAttackingSide = ownerId === state.activePlayerId;
    const canAttackThis = !isDead && isDeclaringAttackers && isAttackingSide && canControl && !c.tapped && !c.summoningSick;
    const canBeBlocker = !isDead && isDeclaringBlockers && !isAttackingSide && canControl && !c.tapped;
    const combatDraggable = canAttackThis || canBeBlocker;
    const reorderAllowed = stackCount === 1 && !isDead && !isDeclaringAttackers && !isDeclaringBlockers && (!isOpponentSide || !!soloControl);
    // A row can also accept a drop of an already-selected attacker, or an
    // already-assigned blocker, being dragged back out to change your mind -
    // right up until "Attack with X" / "Confirm blockers" is pressed.
    const acceptsAttackerRemoval = isDeclaringAttackers && isAttackingSide && canControl;
    const acceptsBlockerRemoval = isDeclaringBlockers && !isAttackingSide && canControl;
    const isLegalTarget = isLegalPendingTarget(c, ownerId);
    const isCounterTransferTarget = isLegalCounterTransferTarget(c);
    const isAttachTarget = isLegalAttachTarget(c, ownerId);
    const isSacrificeChoice = isLegalSacrifice(c, ownerId);
    const isSacrificeCostChoice = isLegalSacrificeCostChoice(c, ownerId);
    const isCounterRemovalCostChoice = isLegalCounterRemovalCostChoice(c, ownerId);
    const isEscalateCostChoice = isLegalEscalateCostChoice(c, ownerId);
    const isKeepOneChoice = isLegalKeepOneChoice(c, ownerId);
    const isCrewChoice = isLegalCrewChoice(c, ownerId);
    const isCrewSelected = !!pendingCrew?.selected.includes(c.instanceId);
    const isConvokeChoice = isLegalConvokeChoice(c, ownerId);
    const isConvokeSelected = !!pendingConvokeCast?.selected.includes(c.instanceId);
    const selected =
      pendingBlocker === c.instanceId ||
      multiSelected.has(c.instanceId) ||
      isLegalTarget ||
      isCounterTransferTarget ||
      isAttachTarget ||
      isSacrificeChoice ||
      isSacrificeCostChoice ||
      isCounterRemovalCostChoice ||
      isEscalateCostChoice ||
      isKeepOneChoice ||
      isCrewSelected ||
      isConvokeSelected;

    // Attached Equipment/Auras stack literally UNDERNEATH the creature they're
    // attached to - the exact same diagonal peek-offset technique as several
    // of the SAME land stacked together (see renderStackedCard's own
    // .battlefield-stack below), just with the creature always pinned as the
    // one front layer on top and each attached permanent as a back layer
    // peeking out from behind it, instead of "several copies of one card".
    const hasAttachedEquipment = attachedEquipment.length > 0;
    const equipmentFootprint = Math.min(attachedEquipment.length, STACK_PEEK_MAX_LAYERS) * activeStackPeekStep;

    // Which card in [creature, ...attachedEquipment] is currently drawn on
    // top - purely a viewing convenience (see stackCycleOffset) so a stack
    // deeper than STACK_PEEK_MAX_LAYERS can still bring every attached card
    // forward to look at, via the arrows rendered below. Rotating the
    // creature itself to the back only affects what's clickable from THIS
    // stack view - cycle it back to front to drag/attack/block with it
    // again, same as any other card you'd need to bring to the front first.
    type StackItem = { instanceId: string; isCreature: true } | { instanceId: string; isCreature: false; eq: CardInstance };
    const stackItems: StackItem[] = hasAttachedEquipment
      ? [{ instanceId: c.instanceId, isCreature: true }, ...attachedEquipment.map((eq): StackItem => ({ instanceId: eq.instanceId, isCreature: false, eq }))]
      : [];
    const rotation = hasAttachedEquipment ? (((stackCycleOffset[c.instanceId] ?? 0) % stackItems.length) + stackItems.length) % stackItems.length : 0;
    const orderedStack = hasAttachedEquipment ? stackItems.map((_, i) => stackItems[(i + rotation) % stackItems.length]) : [];
    const frontItem = orderedStack[0];
    const backStack = orderedStack.slice(1);

    function cycleStack(direction: 1 | -1) {
      setStackCycleOffset((prev) => ({ ...prev, [c.instanceId]: (((prev[c.instanceId] ?? 0) + direction) % stackItems.length + stackItems.length) % stackItems.length }));
    }

    const creatureWrapper = (
      <div
        className={hasAttachedEquipment ? 'battlefield-stack-layer' : undefined}
        style={hasAttachedEquipment ? { zIndex: backStack.length + 1 } : undefined}
        draggable={combatDraggable || reorderAllowed}
        onDragStart={() => setDraggedInstanceId(c.instanceId)}
        onDragOver={(e) => (reorderAllowed || acceptsAttackerRemoval || acceptsBlockerRemoval) && e.preventDefault()}
        onDrop={() => {
          if (acceptsAttackerRemoval && draggedInstanceId && selectedAttackers.has(draggedInstanceId)) {
            removeAttacker(draggedInstanceId);
            setDraggedInstanceId(null);
          } else if (acceptsBlockerRemoval && draggedInstanceId) {
            removeBlockerAssignmentById(draggedInstanceId);
            setDraggedInstanceId(null);
          } else if (reorderAllowed && draggedInstanceId) {
            handleRowDrop(ownerId, 'creatures', rowCards, c.instanceId);
          }
        }}
      >
        {renderStackedCard(
          group,
          c,
          {
            selected,
            onClick: () => {
              if (isDead) return;
              if (isSacrificeChoice) {
                onAction({ type: 'CHOOSE_SACRIFICE', instanceId: c.instanceId });
              } else if (isSacrificeCostChoice) {
                handleSacrificeCostClick(c.instanceId);
              } else if (isCounterRemovalCostChoice) {
                handleCounterRemovalCostClick(c.instanceId);
              } else if (isEscalateCostChoice) {
                handleEscalateCostClick(c.instanceId);
              } else if (isKeepOneChoice) {
                onAction({ type: 'CHOOSE_KEEP_ONE_SACRIFICE_REST', instanceId: c.instanceId }, ownerId);
              } else if (isCrewChoice) {
                setPendingCrew((prev) =>
                  prev
                    ? { ...prev, selected: prev.selected.includes(c.instanceId) ? prev.selected.filter((id) => id !== c.instanceId) : [...prev.selected, c.instanceId] }
                    : prev
                );
              } else if (isConvokeChoice) {
                setPendingConvokeCast((prev) =>
                  prev
                    ? { ...prev, selected: prev.selected.includes(c.instanceId) ? prev.selected.filter((id) => id !== c.instanceId) : [...prev.selected, c.instanceId] }
                    : prev
                );
              } else if (isLegalTarget) {
                onAction({ type: 'CHOOSE_TARGET', targetInstanceId: c.instanceId });
              } else if (isCounterTransferTarget) {
                onAction({ type: 'RESOLVE_COUNTER_TRANSFER', targetInstanceId: c.instanceId }, pendingCounterTransferForYou!.controllerId);
              } else if (isAttachTarget) {
                onAction({ type: 'ATTACH_CARD', instanceId: pendingAttach!.instanceId, targetInstanceId: c.instanceId }, pendingAttach!.ownerId);
                setPendingAttach(null);
              } else if (canAttackThis) toggleAttacker(c.instanceId);
              else if (canBeBlocker) handleBlockerCandidateClick(c.instanceId);
              else setOpenPanelId(c.instanceId);
            },
          },
          canControl,
        )}
      </div>
    );

    return (
      <div key={c.instanceId} className={isDead ? 'destroyed-card-wrapper' : ''} ref={(el) => registerCardRef(c.instanceId, el)}>
        <div
          className={hasAttachedEquipment ? 'battlefield-stack' : undefined}
          style={hasAttachedEquipment ? { width: activeCardWidth + equipmentFootprint, height: activeCardHeight + equipmentFootprint } : undefined}
        >
          {hasAttachedEquipment &&
            backStack.map((item, i) => {
              const depth = Math.min(i + 1, STACK_PEEK_MAX_LAYERS) * activeStackPeekStep;
              const def = item.isCreature ? getCardDefinition(c.defId) : getCardDefinition(item.eq.defId);
              const inst = item.isCreature ? c : item.eq;
              return (
                <div
                  key={item.instanceId}
                  className="battlefield-stack-layer attached-equipment-back-layer"
                  style={{ transform: `translate(${depth}px, ${depth}px)`, zIndex: i }}
                  onClick={() => setOpenPanelId(item.instanceId)}
                >
                  <Card definition={def} instance={inst} />
                </div>
              );
            })}
          {hasAttachedEquipment &&
            (frontItem.isCreature ? (
              creatureWrapper
            ) : (
              <div className="battlefield-stack-layer" style={{ zIndex: backStack.length + 1 }} onClick={() => setOpenPanelId(frontItem.instanceId)}>
                <Card definition={getCardDefinition(frontItem.eq.defId)} instance={frontItem.eq} />
              </div>
            ))}
          {!hasAttachedEquipment && creatureWrapper}
          {hasAttachedEquipment && stackItems.length > 1 && (
            <>
              <button
                type="button"
                className="stack-cycle-arrow stack-cycle-arrow-left"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleStack(-1);
                }}
                aria-label="Show previous card in this stack"
                title="Show previous card in this stack"
              >
                &#9664;
              </button>
              <button
                type="button"
                className="stack-cycle-arrow stack-cycle-arrow-right"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleStack(1);
                }}
                aria-label="Show next card in this stack"
                title="Show next card in this stack"
              >
                &#9654;
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderPlainCard(group: CardInstance[], playerId: string, rowKey: string, rowCards: CardInstance[], reorderAllowed: boolean) {
    const stackCount = group.length;
    // Prefer an untapped copy, so repeatedly double-clicking a stack (e.g. of
    // lands) taps through them one at a time instead of always hitting the same one.
    const c = group.find((g) => !g.tapped) ?? group[0];
    const isPendingManaChoice = manaChoiceQueue.length > 0 && manaChoiceQueue[0].instanceId === c.instanceId;
    const canReorder = reorderAllowed && stackCount === 1;
    const isLegalTarget = isLegalPendingTarget(c, playerId);
    const isSacrificeCostChoice = isLegalSacrificeCostChoice(c, playerId);
    const isCounterRemovalCostChoice = isLegalCounterRemovalCostChoice(c, playerId);
    const canControl = canControlCard(playerId);
    return (
      <div key={c.instanceId} ref={(el) => registerCardRef(c.instanceId, el)}>
        <div
          draggable={canReorder}
          onDragStart={() => canReorder && setDraggedInstanceId(c.instanceId)}
          onDragOver={(e) => reorderAllowed && e.preventDefault()}
          onDrop={() => reorderAllowed && draggedInstanceId && handleRowDrop(playerId, rowKey, rowCards, c.instanceId)}
        >
          {renderStackedCard(
            group,
            c,
            {
              selected: multiSelected.has(c.instanceId) || isPendingManaChoice || isLegalTarget || isSacrificeCostChoice || isCounterRemovalCostChoice,
              onClick: () => {
                if (isSacrificeCostChoice) {
                  handleSacrificeCostClick(c.instanceId);
                } else if (isCounterRemovalCostChoice) {
                  handleCounterRemovalCostClick(c.instanceId);
                } else if (isLegalTarget) onAction({ type: 'CHOOSE_TARGET', targetInstanceId: c.instanceId });
                else setOpenPanelId(c.instanceId);
              },
            },
            canControl,
          )}
        </div>
      </div>
    );
  }

  /**
   * The hand-fan itself, for your own hand only - the opponent's hand never
   * gets a card-shaped row at all (see the isOpponentSide branch below): a
   * face-down card is still shaped and sized like a real card, and showing
   * a whole fanned row of them ate as much screen space as showing your own
   * hand, exactly what a single-board, no-scrolling view can't afford. A
   * plain count reads just as clearly with a fraction of the height.
   * `curveUp` picks which way the arc bows: a hand sitting at the bottom of
   * the screen fans like a smile (center pokes up, edges droop down); a hand
   * placed at the top instead needs the mirror image (center dips down
   * toward the table, edges lift up), or it reads as an upside-down frown.
   */
  function renderHandRow(player: PlayerState, isOpponentSide: boolean, curveUp: boolean) {
    if (isOpponentSide) {
      // Revealed cards (CardInstance.revealedToOpponentWhileInHand - e.g. a
      // library search that "reveals it, puts it into your hand") show
      // face-up and clickable right alongside the plain hand count, for as
      // long as they're genuinely still sitting in this hand - see
      // engine/actions.ts: applyAction's stripStaleRevealMarkers, which
      // drops the flag the instant a card leaves hand for any reason.
      const revealed = player.zones.hand.filter((c) => c.revealedToOpponentWhileInHand);
      return (
        <div className="opponent-hand-row">
          <div className="opponent-hand-count">Opponent hand: {player.zones.hand.length}</div>
          {revealed.length > 0 && (
            <div className="opponent-hand-revealed">
              {revealed.map((c) => (
                <Card key={c.instanceId} definition={getCardDefinition(c.defId)} instance={c} revealedInHand onClick={() => setOpenPanelId(c.instanceId)} />
              ))}
            </div>
          )}
        </div>
      );
    }

    const isControllersTurn = state.activePlayerId === player.id;
    // Only dim hand cards for affordability once mana's actually been tapped -
    // at 0 mana (start of turn, or right after casting something) nothing
    // should look unplayable yet, since the player hasn't had a chance to pay for anything.
    const hasMana = Object.values(player.manaPool).some((amount) => amount > 0);
    const hand = orderedHand(player.zones.hand);

    return (
      <div className="hand-fan your-hand">
        {hand.map((c, i, arr) => {
          const mid = (arr.length - 1) / 2;
          const offset = i - mid;
          const curveY = (curveUp ? 1 : -1) * Math.abs(offset) * 6;
          // Pivot from whichever edge the hand is "held from" - bottom for a
          // hand at the bottom of the screen, top for one mirrored at the top.
          const fanStyle = { transform: `rotate(${offset * 4}deg) translateY(${curveY}px)`, transformOrigin: curveUp ? 'bottom center' : 'top center', zIndex: i };
          const def = getCardDefinition(c.defId);
          const affordable = def.type === 'land' || canPay(player.manaPool, effectiveCastCost(def, player, state.players.find((p) => p.id !== player.id)), 0);
          const isInstantSpeed = def.type === 'instant' || hasKeyword(def, 'flash');
          const dimmed = !(isControllersTurn || isInstantSpeed) || (hasMana && !affordable);
          return (
            <div
              key={c.instanceId}
              className="hand-fan-card"
              style={fanStyle}
              draggable
              onDragStart={(e) => {
                setDraggedInstanceId(c.instanceId);
                // The default drag ghost is captured from this wrapper, which
                // carries the fan's rotate/translate transform - some
                // browsers render that as a blank/plain-image ghost instead
                // of the actual styled card. Pointing setDragImage at the
                // card itself (no transform of its own) fixes that.
                const cardEl = e.currentTarget.querySelector('.card') as HTMLElement | null;
                if (cardEl) e.dataTransfer.setDragImage(cardEl, cardEl.offsetWidth / 2, cardEl.offsetHeight / 2);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleHandDrop(player.id, c.instanceId)}
            >
              <Card definition={def} instance={c} dimmed={dimmed} onClick={() => setOpenPanelId(c.instanceId)} />
            </div>
          );
        })}
      </div>
    );
  }

  /**
   * One row of stacked creatures/others/lands, optionally collapsible to a
   * thin summary strip. `allowMinimize` is only ever true from Full Board -
   * see buildPlayerZonePieces - so the toggle never appears in My
   * View/Opponent View. The ref (used to auto-pan to a player's lands when
   * they open an uncastable instant mid-combat) stays attached to the outer
   * wrapper either way, so it still resolves to *something* sensible even
   * while collapsed.
   */
  function renderBattlefieldRow(
    rowKey: 'creatures' | 'others' | 'lands',
    label: string,
    playerId: string,
    count: number,
    cardsEl: React.ReactNode,
    allowMinimize: boolean,
    refCallback?: (el: HTMLDivElement | null) => void,
  ) {
    const minimizeKey = `${playerId}:${rowKey}`;
    const minimized = allowMinimize && minimizedRows.has(minimizeKey);
    return (
      <div className="battlefield-row-group" ref={refCallback}>
        {allowMinimize && (
          <button className="row-minimize-toggle" onClick={() => toggleRowMinimized(minimizeKey)}>
            {minimized ? `▸ ${label} (${count})` : `▾ ${label}`}
          </button>
        )}
        {!minimized && <div className={`battlefield-row ${rowKey}-row`}>{cardsEl}</div>}
      </div>
    );
  }

  /**
   * `isOpponentSide` is about identity - it decides whether this player's
   * hand stays face-down and whether you're allowed to interact with their
   * permanents, and never changes regardless of view. `mirrorLayout` is
   * purely visual - which end of the row lands/creatures sit on - so
   * Opponent View can render the opponent's own zone with `mirrorLayout`
   * false, showing their board the way THEY see it instead of upside-down
   * across the table, without granting any extra visibility or control.
   * `allowMinimizeRows` is Full-Board-only - see renderBattlefieldRow.
   */
  function buildPlayerZonePieces(
    player: PlayerState,
    isOpponentSide: boolean,
    mirrorLayout: boolean,
    allowMinimizeRows: boolean,
    // Which way the collapse/expand arrow should point - the corner column
    // sits at the LEFT edge everywhere except Full Board's right-hand rail
    // (see the full-board-grid JSX, the only caller that passes true), so
    // the glyphs need to mirror there: pointing further right would push
    // off-screen instead of toward the board.
    cornerOnRightSide: boolean = false,
  ) {
    const { creatures, others, lands } = splitBattlefield(player.zones.battlefield);
    const visibleCreatures = creatures.filter((c) => !isInCombatZone(player.id, c.instanceId));
    const creatureGroups = groupForStacking(orderedRow(player.id, 'creatures', visibleCreatures), (c) => state.pendingDeaths.includes(c.instanceId));
    const otherGroups = groupForStacking(orderedRow(player.id, 'others', others));
    const landGroups = groupForStacking(orderedRow(player.id, 'lands', lands));
    const commanderCard = player.zones.commander[0];
    const isDrawStep = state.phase === 'draw' && state.activePlayerId === player.id && !player.hasDrawnThisTurn;
    const canDrawHere = player.id === yourPlayerId || (soloControl && isOpponentSide);
    const selectEnabled = !isOpponentSide || !!soloControl;

    // Dark Confidant (RevealTopThenLoseLifeByManaValueEffect) leaves its
    // reveal sitting face-up on top of the library - publicly, for BOTH
    // players' views of this pile, since revealing is public - until its
    // controller clicks it (RESOLVE_REVEAL_PICKUP) to actually take it into
    // hand and pay the life loss. See GameBoard's revealOutlineFor for the
    // matching red/purple outline on the Dark Confidant permanent itself.
    const pendingReveal = state.pendingRevealPickup?.controllerId === player.id ? state.pendingRevealPickup : null;
    const canActOnLibrary = canDrawHere;
    // "You may look at the top card of your library any time. You may play
    // lands and cast spells from the top of your library." (Kefka's Tower) -
    // shows the real top card face-up instead of the usual face-down
    // placeholder, same "public once revealed" shape as pendingReveal just
    // above, clickable to open the card panel (which exposes the actual
    // Play/Cast action - see CardActionsPanel's libraryTopPlayAllowed).
    const libraryTopVisible =
      !pendingReveal && player.zones.battlefield.some((c) => !!getCardDefinition(c.defId).grantsPlayFromTopOfLibrary) ? player.zones.library[0] : null;

    // Library/graveyard/exile share one "pile" spot now instead of two
    // separate corners (see activeCornerZone) - whichever is active renders
    // as the big clickable pile, the other two shrink to a small label
    // underneath that switches which one is active when clicked. Library
    // keeps its existing draw/reveal-pickup click behavior; graveyard/exile
    // keep their existing "click to open the full zone view" behavior -
    // only which one is up front changed, not what clicking it does.
    const activeZone = activeCornerZone[player.id] ?? 'library';
    const inactiveZones = (['library', 'graveyard', 'exile'] as const).filter((z) => z !== activeZone);
    const ZONE_LABEL: Record<'library' | 'graveyard' | 'exile', string> = { library: 'Library', graveyard: 'Graveyard', exile: 'Exile' };

    const activePileEl =
      activeZone === 'library' ? (
        <div
          className={`library-stack ${isDrawStep ? 'library-stack-draw-highlight' : ''} ${canActOnLibrary ? 'library-stack-clickable' : ''} ${pendingReveal ? 'library-stack-reveal-pending' : ''}`}
          onClick={() => {
            if (pendingReveal) {
              if (canActOnLibrary) onAction({ type: 'RESOLVE_REVEAL_PICKUP' }, player.id);
              return;
            }
            // Outside the draw step, a library-top-play grant takes priority
            // over drawing - the normal "click to draw" affordance still
            // works during the actual draw step.
            if (libraryTopVisible && !isDrawStep) {
              setOpenPanelId(libraryTopVisible.instanceId);
              return;
            }
            if (!canActOnLibrary) return;
            onAction({ type: 'DRAW_CARD' }, player.id);
          }}
          title={
            pendingReveal
              ? canActOnLibrary
                ? 'Click to pick up the revealed card'
                : 'Revealed - waiting to be picked up'
              : libraryTopVisible && !isDrawStep
                ? 'Click to view/play from the top of your library'
                : canActOnLibrary
                  ? 'Click to draw'
                  : ''
          }
        >
          {pendingReveal ? (
            <Card definition={getCardDefinition(pendingReveal.revealedCard.defId)} instance={pendingReveal.revealedCard} />
          ) : libraryTopVisible ? (
            <Card definition={getCardDefinition(libraryTopVisible.defId)} instance={libraryTopVisible} />
          ) : (
            <Card definition={{ id: '', name: '', type: 'creature', costLabel: '', text: '', imagePath: '' }} faceDown />
          )}
          <span className="library-stack-count">{player.zones.library.length}</span>
        </div>
      ) : (
        (() => {
          const cards = player.zones[activeZone];
          const topCard = cards[cards.length - 1];
          return (
            <div className="zone-pile" onClick={() => setOpenZone({ playerId: player.id, zone: activeZone })}>
              {topCard ? (
                topCard.faceDown ? (
                  <Card definition={{ id: '', name: '', type: 'creature', costLabel: '', text: '', imagePath: '' }} faceDown />
                ) : (
                  <Card definition={getCardDefinition(topCard.defId)} />
                )
              ) : (
                <div className="card card-empty-pile" />
              )}
              <span className="zone-pile-count">{cards.length}</span>
            </div>
          );
        })()
      );

    // Either corner - yours or the opponent's - can be collapsed to a thin
    // strip at will, to reclaim board space. While it's THIS player's draw
    // step and they haven't drawn yet, it pops back out automatically
    // regardless of the stored preference (so you never miss watching a
    // draw happen), then folds back down again the instant they draw -
    // collapsedCorners itself is untouched by this, so it's a purely
    // temporary display override, not a change to what you last chose.
    const autoPeekDuringDraw = state.phase === 'draw' && state.activePlayerId === player.id && !player.hasDrawnThisTurn;
    // Yours defaults to shown, the opponent's defaults to hidden - both are
    // just starting points now that either side can be freely toggled.
    const storedCornerCollapsed = collapsedCorners[player.id] ?? player.id !== yourPlayerId;
    const cornerCollapsed = storedCornerCollapsed && !autoPeekDuringDraw;
    const collapsedArrowGlyph = cornerOnRightSide ? '◀' : '▶';
    const expandedArrowGlyph = cornerOnRightSide ? '▶' : '◀';

    const cornerColumn = cornerCollapsed ? (
      <div className="corner-column corner-column-collapsed">
        <button
          className="corner-column-toggle-arrow corner-column-toggle-arrow-hidden"
          onClick={() => setCollapsedCorners((prev) => ({ ...prev, [player.id]: false }))}
          title="Show commander/library/graveyard/exile"
          aria-label="Show commander/library/graveyard/exile"
        >
          {collapsedArrowGlyph}
        </button>
      </div>
    ) : (
      <div className="corner-column">
        <button
          className="corner-column-toggle-arrow"
          onClick={() => setCollapsedCorners((prev) => ({ ...prev, [player.id]: true }))}
          title="Hide commander/library/graveyard/exile to save space"
          aria-label="Hide commander/library/graveyard/exile to save space"
        >
          {expandedArrowGlyph}
        </button>
        {commanderCard ? (
          <Card definition={getCardDefinition(commanderCard.defId)} instance={commanderCard} onClick={() => setOpenPanelId(commanderCard.instanceId)} />
        ) : (
          <div className="corner-box">In play</div>
        )}
        <div className="corner-pile-cycler">
          <span className="corner-pile-active-label">{ZONE_LABEL[activeZone]}</span>
          {activePileEl}
          <div className="corner-pile-others">
            {inactiveZones.map((z) => (
              <button
                key={z}
                className="corner-pile-other-button"
                onClick={() => setActiveCornerZone((prev) => ({ ...prev, [player.id]: z }))}
                title={`Look at ${ZONE_LABEL[z].toLowerCase()}`}
              >
                {ZONE_LABEL[z]} ({player.zones[z].length})
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    const creaturesRowEl = renderBattlefieldRow(
      'creatures',
      'Creatures',
      player.id,
      creatureGroups.length,
      creatureGroups.map((g) => renderCreatureCard(g, isOpponentSide, visibleCreatures, player.id)),
      allowMinimizeRows,
    );
    const othersRowEl = renderBattlefieldRow(
      'others',
      'Other permanents',
      player.id,
      otherGroups.length,
      otherGroups.map((g) => renderPlainCard(g, player.id, 'others', others, selectEnabled)),
      allowMinimizeRows,
    );
    const landsRowEl = renderBattlefieldRow(
      'lands',
      'Lands',
      player.id,
      landGroups.length,
      landGroups.map((g) => renderPlainCard(g, player.id, 'lands', lands, selectEnabled)),
      allowMinimizeRows,
      (el) => registerLandsRowRef(player.id, el),
    );

    const battlefieldRows = mirrorLayout ? (
      <>
        {landsRowEl}
        {othersRowEl}
        {creaturesRowEl}
      </>
    ) : (
      <>
        {creaturesRowEl}
        {othersRowEl}
        {landsRowEl}
      </>
    );

    const centerColumn = (
      <div
        className="zone-center-column"
        onMouseDown={(e) => startSelection(e, selectEnabled)}
        onMouseMove={updateSelection}
        onMouseUp={finishSelection}
        onMouseLeave={finishSelection}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleBoardDrop(player.id)}
      >
        {battlefieldRows}
      </div>
    );

    // A hand placed at the top of its zone (mirrorLayout) needs the mirrored
    // arc - see renderHandRow. Your own hand never renders in-flow anymore -
    // it lives permanently in the docked tray (see the bottom of the render
    // function) - so this is only ever actually used for the opponent's.
    const handRow = isOpponentSide ? renderHandRow(player, isOpponentSide, !mirrorLayout) : null;

    // "Any other target" effects (currently just dealDamageToAnyOtherTargetAndSelf)
    // can name a PLAYER as their second pick, not just a creature - shown as
    // a clickable life total (either player's, including your own - the
    // printed text names no restriction beyond "other than the source").
    // See types.ts: GameAction 'CHOOSE_TARGET's targetPlayerId, a
    // general-purpose addition meant to be reused by future "any target"
    // effects rather than a one-off UI for this single effect.
    const canTargetThisPlayer =
      !!pendingTargetForYou && pendingTargetForYou.effect.type === 'dealDamageToAnyOtherTargetAndSelf' && !!pendingTargetForYou.firstInstanceId;

    const lifeRow = (
      <>
        {/* Mana lives here now instead of inside the corner column, so it
            stays visible even when that corner is collapsed (see
            collapsedCorners) - it's needed on every turn, not just while
            looking at your deck. */}
        <ManaRow player={player} />
        <div className="life-row">
        <div className="life-total-group">
          <span
            className={`life-total${canTargetThisPlayer ? ' life-total-targetable' : ''}`}
            onClick={canTargetThisPlayer ? () => onAction({ type: 'CHOOSE_TARGET', targetInstanceId: null, targetPlayerId: player.id }, pendingTargetForYou!.controllerId) : undefined}
            title={canTargetThisPlayer ? `Target ${player.name}` : undefined}
          >
            {player.life} life
          </span>
          {player.commanderDamageTaken > 0 && <span className="commander-damage-badge">Commander dmg: {player.commanderDamageTaken}</span>}
          {player.poisonCounters > 0 && <span className="commander-damage-badge">Poison: {player.poisonCounters}</span>}
          {mutualActive && (
            <div className="life-buttons">
              {[-5, -1, 1, 5].map((delta) => (
                <button key={delta} className="life-step-button" onClick={() => onAction({ type: 'ADJUST_LIFE', playerId: player.id, delta })}>
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </>
    );

    return { cornerColumn, centerColumn, handRow, lifeRow };
  }

  /** My View/Opponent View - unchanged single-section layout, corner columns inline. */
  function renderPlayerZone(player: PlayerState, isOpponentSide: boolean, mirrorLayout: boolean = isOpponentSide) {
    const { cornerColumn, centerColumn, handRow, lifeRow } = buildPlayerZonePieces(player, isOpponentSide, mirrorLayout, false);
    return (
      // player-zone-fill: this is only ever the single board shown in My
      // View/Opponent View (Full Board builds its own zones separately) -
      // see .player-zone-fill in styles.css for why it needs the modifier
      // rather than just being part of the base .player-zone rule.
      <section className={`player-zone player-zone-fill ${isOpponentSide ? 'opponent-zone' : 'your-zone'}`}>
        {mirrorLayout && lifeRow}
        {mirrorLayout && handRow}
        <div className="zone-top-row">
          {mirrorLayout ? (
            <>
              {centerColumn}
              {cornerColumn}
            </>
          ) : (
            <>
              {cornerColumn}
              {centerColumn}
            </>
          )}
        </div>
        {!mirrorLayout && handRow}
        {!mirrorLayout && lifeRow}
      </section>
    );
  }

  const youAreReadyForCombat = state.combatReadyPlayers.includes(yourPlayerId);
  const nextLabel = isDeclaringAttackers
    ? selectedAttackers.size > 0
      ? `Attack with ${selectedAttackers.size}`
      : 'Declare no attackers'
    : isDeclaringBlockers
      ? 'Confirm blockers'
      : isWaitingOnBlockers
        ? 'Waiting on opponent\u2019s blocks\u2026'
        : state.phase === 'combat_damage'
          ? youAreReadyForCombat
            ? 'Waiting on opponent\u2026'
            : 'Resolve Combat'
          : undefined;

  // --- Combat zone: attacker cards on top, an empty (until you drop
  // something into it) blocker slot directly below each one. Nothing is
  // pre-populated - the only way a card appears in a slot is you dragging
  // it there yourself from the battlefield. Multiple blockers on one
  // attacker stack visually in the same slot. ---------------------------
  const blockerSlotsVisible = !isDeclaringAttackers && state.declaredAttackers.length > 0;

  // Combat forces Full Board (see showCombatZones), which is a much taller
  // layout than whatever single-board view was showing a moment ago -
  // without this, the page keeps whatever scroll position it already had,
  // which now points at a completely different part of the new, taller
  // page (usually well past the combat zone - the "overshoot"). Centering
  // explicitly on declaring attackers keeps the intended reading order on
  // screen: opponent's creatures above the red zone, yours below it.
  //
  // Re-runs on selectedAttackers.size too, not just the phase transition -
  // dragging each creature into the zone grows it by another row, which
  // shifts its center every time. Re-centering only once, on entry, left it
  // drifting out of center as soon as you actually started dragging
  // attackers in - re-running per attacker keeps it centered throughout.
  useEffect(() => {
    if (!isDeclaringAttackers) return;
    // Two frames, same as changeViewMode's own settling wait - the content
    // swap into Full Board and the zoom wrapper's ResizeObserver follow-up
    // (see naturalBoardHeight) both need to land before this position means anything.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        combatZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }, [isDeclaringAttackers, selectedAttackers.size]);

  // Once blocker slots appear, the zone grows a full extra row of cards -
  // re-centering on the whole (now taller) box the same way would push its
  // top half off the top of the screen. Aligning the newly-appeared slots'
  // own top edge to screen-center instead keeps them (and enough of what's
  // above) comfortably in view without recalculating around the zone's new height.
  useEffect(() => {
    if (!blockerSlotsVisible) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = firstBlockerSlotRef.current;
        if (!el) return;
        const targetY = window.scrollY + el.getBoundingClientRect().top - window.innerHeight / 2;
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      });
    });
  }, [blockerSlotsVisible]);

  // The attacking player (not the defender) chooses the damage order once an
  // attacker ends up with 2+ blockers - one modal per multi-blocked attacker,
  // tracked via orderedAttackerIds so it doesn't reappear once confirmed.
  const attackerNeedingOrder =
    state.phase === 'combat_damage' && (soloControl || state.activePlayerId === yourPlayerId)
      ? state.combatAssignments.find((a) => a.blockerInstanceIds.length >= 2 && !orderedAttackerIds.has(a.attackerInstanceId))
      : undefined;

  const combatZoneEl = showCombatZones && (
    <div className="combat-zone-merged" ref={combatZoneRef}>
      <div className="combat-zone-label">
        {isDeclaringAttackers
          ? 'Attacking \u2014 drag your creatures here'
          : isDeclaringBlockers
            ? 'Combat \u2014 drag your creatures onto the empty slot below an attacker to block it'
            : 'Combat \u2014 cast an instant if you want, then both players press Resolve Combat'}
      </div>
      <div
        className="combat-columns-row"
        onDragOver={(e) => isDeclaringAttackers && e.preventDefault()}
        onDrop={() => {
          if (isDeclaringAttackers && draggedInstanceId) {
            addAttackerFromDrag(draggedInstanceId);
            setDraggedInstanceId(null);
          }
        }}
      >
        {(isDeclaringAttackers ? Array.from(selectedAttackers) : state.declaredAttackers).map((id, columnIndex) => {
          const found = findCard(state, id);
          if (!found) return null;
          const attackerIsDead = state.pendingDeaths.includes(id);
          const blockers = isDeclaringAttackers ? [] : blockersFor(id);
          // Only previewed with exactly one blocker - with more, the attacker
          // still has to choose a damage order before it's determined at all.
          const soleBlocker = blockers.length === 1 ? findCard(state, blockers[0]) : null;
          const singleBlockPreview = soleBlocker
            ? previewSingleBlockDeaths(
                getCardDefinition(found.card.defId),
                found.card,
                found.player.id,
                getCardDefinition(soleBlocker.card.defId),
                soleBlocker.card,
                soleBlocker.player.id,
                state,
              )
            : null;

          // Purely cosmetic combat flourishes - none of these change what's
          // legal, just what an attacker with the keyword looks like while
          // it's in the combat zone. See creatureHasKeywordNow for why this
          // checks board-granted keywords too, not just printed/temporary ones.
          const attackerDef = getCardDefinition(found.card.defId);
          const hasFlying = creatureHasKeywordNow(state, found.player.id, found.card, attackerDef, 'flying');
          const hasTrample = creatureHasKeywordNow(state, found.player.id, found.card, attackerDef, 'trample');
          const hasFirstStrike = creatureHasKeywordNow(state, found.player.id, found.card, attackerDef, 'first strike');
          const hasDoubleStrike = creatureHasKeywordNow(state, found.player.id, found.card, attackerDef, 'double strike');
          const hasLifelink = creatureHasKeywordNow(state, found.player.id, found.card, attackerDef, 'lifelink');
          const hasDeathtouch = creatureHasKeywordNow(state, found.player.id, found.card, attackerDef, 'deathtouch');
          const hasMenace = creatureHasKeywordNow(state, found.player.id, found.card, attackerDef, 'menace');
          // "Whenever this creature deals combat damage to a player, that
          // player loses the game" (Summon: Primal Odin's Zantetsuken
          // chapter, granted at lore counter 2 - see
          // CardDefinition.saga/grantCombatDamageToPlayerCausesLoss) - the
          // lore-counter check, not just the granted flag alone, is what
          // keeps this from also lighting up after chapter III (which
          // sacrifices Odin anyway, but a future card with a similar
          // grant-at-a-chapter pattern might not). Blocking doesn't make
          // this safe to ignore - with trample, damage still gets through
          // (engine/combat.ts's dealDirectDamageToDefender handles the
          // trample-over case exactly the same as an unblocked hit), so the
          // warning stays regardless of whether a blocker is assigned.
          const loreCounterAmount = found.card.counters.find((c) => c.label === 'lore')?.amount ?? 0;
          const hasLoseGameOnDamage = loreCounterAmount === 2 && !!found.card.grantedCombatDamageToPlayerCausesLoss;

          const attackerCellEl = (
            <div
              className={`combat-attacker-cell ${attackerIsDead || singleBlockPreview?.attackerDies ? 'destroyed-card-wrapper' : ''} ${
                hasFlying ? 'combat-fx-flying' : ''
              } ${hasTrample ? 'combat-fx-trample' : ''}`}
              draggable={isDeclaringAttackers}
              onDragStart={() => isDeclaringAttackers && setDraggedInstanceId(id)}
            >
              <Card
                definition={getCardDefinition(found.card.defId)}
                instance={{ ...found.card, tapped: false }}
                onClick={() => setOpenPanelId(id)}
              />
              {(hasFirstStrike || hasDoubleStrike) && (
                <span
                  className={`combat-fx-strike-badge ${hasDoubleStrike ? 'combat-fx-strike-badge-double' : ''}`}
                  title={hasDoubleStrike ? 'Double strike' : 'First strike'}
                >
                  {'⚡'}
                  {hasDoubleStrike && <span className="combat-fx-strike-badge combat-fx-strike-badge-echo">{'⚡'}</span>}
                </span>
              )}
              {hasLifelink && (
                <span className="combat-fx-lifelink" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`combat-fx-lifelink-plus combat-fx-lifelink-plus-${i}`}>
                      {'+'}
                    </span>
                  ))}
                </span>
              )}
            </div>
          );

          const blockerSlotEl = blockerSlotsVisible && (
            <div
              className={`combat-blocker-slot ${hasLoseGameOnDamage ? 'combat-blocker-slot-lethal' : ''}`}
              ref={columnIndex === 0 ? firstBlockerSlotRef : undefined}
              onDragOver={(e) => isDeclaringBlockers && e.preventDefault()}
              onDrop={() => {
                if (isDeclaringBlockers && draggedInstanceId) {
                  assignBlocker(id, draggedInstanceId);
                  setDraggedInstanceId(null);
                }
              }}
              onClick={() => isDeclaringBlockers && handleAttackerClickForBlocking(id)}
            >
              {hasDeathtouch && (
                <span className="combat-fx-deathtouch-badge" title="Deathtouch - any damage from this attacker is lethal">
                  {'☠️'}
                </span>
              )}
              {blockers.length === 0 ? (
                hasMenace ? (
                  // Menace needs two or more blockers - shown as two empty
                  // slots side by side instead of one, even though dropping
                  // on either half still just calls the same assignBlocker
                  // (the parent .combat-blocker-slot is the real drop target).
                  <div className="combat-blocker-slot-menace-pair">
                    <span className="combat-blocker-slot-empty combat-blocker-slot-empty-half">
                      {isDeclaringBlockers ? 'Drop blocker here' : hasLoseGameOnDamage ? 'If this creature deals combat damage you lose the game' : 'No blockers'}
                    </span>
                    <span className="combat-blocker-slot-empty combat-blocker-slot-empty-half">{isDeclaringBlockers ? 'Drop blocker here' : 'Menace — needs 2+'}</span>
                  </div>
                ) : (
                  <span className="combat-blocker-slot-empty">
                    {isDeclaringBlockers ? 'Drop blocker here' : hasLoseGameOnDamage ? 'If this creature deals combat damage you lose the game' : 'No blockers'}
                  </span>
                )
              ) : blockers.length >= 3 ? (
                // Three or more read better as a pile, like a land stack
                // on the battlefield - click it to see (and, while still
                // declaring blockers, remove) any of them individually.
                <div
                  className="combat-blocker-pile"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenBlockerPile(id);
                  }}
                  title="Click to see all blockers"
                >
                  {blockers.slice(0, 3).map((bId, i) => {
                    const bf = findCard(state, bId);
                    if (!bf) return null;
                    return (
                      <div
                        key={bId}
                        className="combat-blocker-stacked combat-blocker-pile-layer"
                        style={{ transform: `translate(${i * 8}px, ${i * 8}px)`, zIndex: i }}
                      >
                        <Card definition={getCardDefinition(bf.card.defId)} instance={{ ...bf.card, tapped: false }} />
                      </div>
                    );
                  })}
                  <span className="battlefield-stack-count combat-blocker-pile-count">×{blockers.length}</span>
                </div>
              ) : (
                // Two blockers read more clearly side by side.
                blockers.map((bId, i) => {
                  const bf = findCard(state, bId);
                  if (!bf) return null;
                  const blockerIsDead = state.pendingDeaths.includes(bId);
                  const wouldDie = blockers.length === 1 && singleBlockPreview?.blockerDies;
                  return (
                    <div
                      key={bId}
                      className={`combat-blocker-stacked ${blockerIsDead || wouldDie ? 'destroyed-card-wrapper' : ''}`}
                      style={{ marginLeft: i > 0 ? 8 : 0, zIndex: i }}
                      draggable={isDeclaringBlockers}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        if (isDeclaringBlockers) setDraggedInstanceId(bId);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPanelId(bId);
                      }}
                      title={isDeclaringBlockers ? 'Drag out to remove this blocker - click to view' : ''}
                    >
                      <Card definition={getCardDefinition(bf.card.defId)} instance={{ ...bf.card, tapped: false }} />
                    </div>
                  );
                })
              )}
            </div>
          );

          // The active (attacking) player sees their blocker coming in from
          // above their attacker; the defending player sees it below - same
          // two elements, just swapped depending on whose screen this is.
          const isAttackerPerspective = state.activePlayerId === yourPlayerId;
          return (
            <div key={id} className="combat-column">
              {isAttackerPerspective ? (
                <>
                  {blockerSlotEl}
                  {attackerCellEl}
                </>
              ) : (
                <>
                  {attackerCellEl}
                  {blockerSlotEl}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="game-board-layout">
      {selectionBox && <div className="selection-box" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.w, height: selectionBox.h }} />}

      {multiSelected.size > 0 && (
        <div className="multi-select-toolbar">
          <span>{multiSelected.size} selected</span>
          <button onClick={tapMultiSelected}>Tap</button>
          <button onClick={() => setMultiSelected(new Set())}>Clear</button>
        </div>
      )}

      {manaChoiceQueue.length > 0 && (
        <div className="mana-choice-toolbar">
          <span>Choose which mana to add</span>
          <div className="mana-choice-buttons">
            {manaChoiceQueue[0].options.map((color) => (
              <button key={color} className={`mana-choice-button mana-${color}`} onClick={() => resolveManaChoice(color)}>
                {color}
              </button>
            ))}
          </div>
          <button className="mana-choice-cancel" onClick={cancelManaChoice}>
            Cancel
          </button>
        </div>
      )}

      {/* Rendered outside the (possibly transform: scale'd) board on purpose -
          a `transform` on an ancestor becomes the containing block for
          position: fixed descendants, which would shrink this to the
          zoomed board's box instead of covering the real viewport. */}
      {state.winnerId && !winnerDismissed && (
        <div className="winner-overlay" onClick={() => setWinnerDismissed(true)}>
          <div className="winner-banner" onClick={(e) => e.stopPropagation()}>
            {state.winnerId === yourPlayerId ? 'You win!' : `${opponent.name} wins.`}
            <div className="winner-dismiss-hint">Click anywhere to close</div>
          </div>
        </div>
      )}

      {/* Pinned and impossible to miss, in the "danger" red - Opponent View
          disables all interaction below (pointer-events: none), so a player
          who forgets which view they're in shouldn't be left wondering why
          nothing responds to clicks. */}
      {isOpponentViewLocked && (
        <div className="opponent-view-lock-banner">
          <span>Viewing {opponent.name}'s side</span>
          <button className="opponent-view-exit-button" onClick={() => changeViewMode('mine')}>
            End Opponent View
          </button>
        </div>
      )}

      {pendingAttach &&
        (() => {
          const equipCard = findCard(state, pendingAttach.instanceId);
          const equipDef = equipCard ? getCardDefinition(equipCard.card.defId) : null;
          const equipName = equipDef?.name ?? 'This card';
          const isEquipment = !!equipDef?.equipCost;
          return (
            <div className="pending-target-banner">
              <span>
                Choose a{isEquipment ? ' creature you control' : 'n eligible permanent'} to attach {equipName} to.
              </span>
              <button className="opponent-view-exit-button" onClick={() => setPendingAttach(null)}>
                Cancel
              </button>
            </div>
          );
        })()}

      {pendingTargetForYou &&
        (() => {
          const effect = pendingTargetForYou.effect;
          const text =
            effect.type === 'tapAndStun'
              ? `Choose a target for ${pendingTargetSourceName}'s ability - click an opponent's ${
                  effect.targetType === 'artifactOrCreature' ? 'artifact or creature' : effect.targetType
                }.`
              : effect.type === 'tapTargetThenCounterSelfByPowerDifferenceIfGreater'
              ? `Choose a creature an opponent controls for ${pendingTargetSourceName} to tap.`
              : effect.type === 'tapStunAndGainLifeForNonbasicLands'
                ? `Choose up to one opponent's nonland permanent for ${pendingTargetSourceName}'s ability to tap and stun - or Skip.`
              : effect.type === 'chooseCreatureDebuffOthersAndWatchLeave'
                ? `Choose an opponent's creature for ${pendingTargetSourceName}'s ability - other creatures get ${effect.power}/${effect.toughness} until end of turn.`
              : effect.type === 'pumpTarget' || effect.type === 'putCounterOnTarget'
                ? `Choose a target for ${pendingTargetSourceName}'s ability - click any creature (either player's).`
                : effect.type === 'debuffTargetByGraveyard'
                  ? `Choose a target for ${pendingTargetSourceName}'s ability - click an opponent's creature.`
                  : effect.type === 'selfFightTarget'
                    ? `Choose a creature for ${pendingTargetSourceName} to fight (either player's)${effect.optional ? ' - or Skip.' : '.'}`
                    : effect.type === 'chooseCreaturesFight'
                      ? pendingTargetForYou.firstInstanceId
                        ? "Now choose an opponent's creature to fight it."
                        : 'Choose a creature you control to fight.'
                      : effect.type === 'chooseCreatureDealsDamageToOpponentCreature'
                        ? pendingTargetForYou.firstInstanceId
                          ? "Now choose an opponent's creature to deal damage to."
                          : 'Choose a creature you control to deal damage.'
                        : effect.type === 'dealDamageToAnyOtherTargetAndSelf'
                          ? pendingTargetForYou.firstInstanceId
                            ? 'Now choose any other target - a creature (either player’s) or a player’s life total.'
                            : 'Choose a creature you control as the damage source.'
                          : effect.type === 'putCounterOnTargetLand'
                            ? `Choose a land for ${pendingTargetSourceName}'s ability (either player's).`
                            : effect.type === 'modifySagaLoreCounter'
                        ? `Choose a Saga you control for ${pendingTargetSourceName}'s ability.`
                        : effect.type === 'tapTarget'
                          ? `Choose a ${effect.targetFilter === 'nonlandPermanent' ? 'nonland permanent' : 'creature'} for ${pendingTargetSourceName}'s ability to tap (either player's).`
                          : effect.type === 'putCounterOnUpToOneOwnCreature'
                            ? `Choose up to one creature you control for ${pendingTargetSourceName}'s ability - or Skip.`
                            : effect.type === 'attachSelfToTarget'
                              ? `Choose a${effect.targetTypeFilter === 'artifactOrCreature' ? 'n artifact or creature' : ' creature'}${effect.allowAnyController ? ' (either player’s)' : ' you control'} for ${pendingTargetSourceName} to attach to${effect.optional ? ' - or Skip.' : '.'}`
                              : effect.type === 'createTokenCopyOfTarget'
                                ? `Choose an artifact, creature, or land for ${pendingTargetSourceName} to create a token copy of (either player's).`
                                : effect.type === 'destroyOpponentCreature'
                                ? `Choose an opponent's creature for ${pendingTargetSourceName}'s ability to destroy.`
                                : effect.type === 'bounceTarget'
                                  ? `Choose a nonland permanent for ${pendingTargetSourceName}'s ability to return to its owner's hand (either player's).`
                                  : effect.type === 'bounceUpToOneOtherNonlandPermanent'
                                  ? `Choose up to one other nonland permanent for ${pendingTargetSourceName}'s ability to return to its owner's hand - or Skip.`
                                  : effect.type === 'putCounterOnUpToOneOtherCreatureEqualToOwnPower'
                                  ? `Choose up to one other creature for ${pendingTargetSourceName}'s ability - or Skip.`
                                  : effect.type === 'damageTargetAndControllerByEquipmentCount'
                                  ? `Choose a creature for ${pendingTargetSourceName}'s ability to damage.`
                                  : effect.type === 'pumpAnotherControlledCreature'
                                  ? `Choose another creature you control for ${pendingTargetSourceName}'s ability.`
                                  : effect.type === 'damageTargetCreature'
                                  ? `Choose a creature for ${pendingTargetSourceName}'s ability to damage.`
                                  : effect.type === 'sweepDamageFromChosenCreature'
                                  ? `Choose a creature you control for ${pendingTargetSourceName}'s ability - it deals damage equal to its power to every other creature.`
                                  : effect.type === 'grantTemporaryBaseStatsAndDeathReturn'
                                  ? `Choose a creature you control for ${pendingTargetSourceName}'s ability.`
                                  : effect.type === 'untapTargetAttacker'
                                  ? `Choose an attacking creature for ${pendingTargetSourceName}'s ability to untap.`
                                  : effect.type === 'grantKeywordsToTargetPermanent'
                                  ? `Choose a permanent for ${pendingTargetSourceName}'s ability - it gains ${effect.keywords.join(' and ')} until end of turn (either player's).`
                                  : effect.type === 'gainControlOfTargetCreature'
                                  ? `Choose a creature${effect.opponentControlledOnly ? " an opponent controls" : " (either player's)"} for ${pendingTargetSourceName} to gain control of until end of turn.`
                                  : effect.type === 'giveControlOfAnotherOwnPermanentToOpponent'
                                  ? `Choose another permanent you control for ${pendingTargetSourceName}'s ability to give to your opponent.`
                                  : effect.type === 'gainControlOfTargetEquipmentAndAttach'
                                  ? pendingTargetForYou.firstInstanceId
                                    ? 'Now choose an Equipment (either player’s) to gain control of and attach.'
                                    : 'Choose a creature you control for the Equipment to be attached to.'
                                  : effect.type === 'pumpUpToTwoTargets'
                                  ? `Choose one or two creatures for ${pendingTargetSourceName}'s ability (either player's)${pendingTargetForYou.firstInstanceId ? ' - or Skip to stop at one.' : '.'}`
                                  : effect.type === 'putCounterOnAnotherCreatureGrantsIndestructibleUntilNextTurn'
                                  ? `Choose another creature you control for ${pendingTargetSourceName}'s ability.`
                                  : effect.type === 'exileThenReturnTargetOwnCreature'
                                  ? `Choose a creature you control for ${pendingTargetSourceName} to exile and return to the battlefield.`
                                  : effect.type === 'attachAllControlledEquipmentToTargetCreature'
                                  ? `Choose a creature you control for ${pendingTargetSourceName}'s ability - or Skip.`
                                  : effect.type === 'exileTargetPermanent'
                                  ? `Choose ${effect.targetFilter === 'artifact' ? 'an artifact' : effect.targetFilter === 'creature' ? 'a creature' : 'a permanent'} for ${pendingTargetSourceName}'s ability to exile (either player's).`
                                  : effect.type === 'becomeCopyOfAnyCreatureThenAddCounters'
                                  ? `Choose a creature (either player's) for ${pendingTargetSourceName} to enter as a copy of, or Skip to enter as itself.`
                                  : effect.type === 'exileTargetCreatureWithLessPowerUntilSourceLeaves'
                                  ? `Choose a creature the defending player controls with power less than ${pendingTargetSourceName}'s for it to exile until ${pendingTargetSourceName} leaves the battlefield.`
                                  : effect.type === 'putStunCounterOnTargetAttacker'
                                  ? `Choose a creature attacking you for ${pendingTargetSourceName} to put a Stun counter on.`
                                  : effect.type === 'proliferate'
                                  ? `Choose a permanent with a counter on it to proliferate, or Skip to stop.`
                                  : effect.type === 'exileTargetOpponentCreatureUntilSourceLeaves'
                                  ? `Choose an opponent's creature for ${pendingTargetSourceName} to exile until it leaves the battlefield.`
                                  : effect.type === 'tapUpToOneTargetCreatureAndStun'
                                  ? `Choose up to one creature for ${pendingTargetSourceName}'s ability to tap and put a Stun counter on (either player's) - or Skip.`
                                  : effect.type === 'putCounterOnUpToTwoOwnCreatures'
                                  ? `Choose one or two creatures you control for ${pendingTargetSourceName}'s ability${pendingTargetForYou.firstInstanceId ? ' - or Skip to stop at one.' : '.'}`
                                  : effect.type === 'returnUpToTwoTargetPermanentsFromGraveyardToHand'
                                  ? `Choose one or two permanent cards in your graveyard to return to hand${pendingTargetForYou.firstInstanceId ? ' - or Skip to stop at one.' : '.'}`
                                  : effect.type === 'sacrificeOwnCreatureThenDraw'
                                  ? `Choose a creature you control to sacrifice.`
                                  : effect.type === 'revealUntilCreatureThenPutCountersEqualToManaValue'
                                  ? `Choose a creature you control for ${pendingTargetSourceName}'s ability to put +1/+1 counters on.`
                                  : effect.type === 'putCounterOnTargetCommanderEnteredThisTurn'
                                  ? `Choose a commander that entered the battlefield this turn (either player's) for ${pendingTargetSourceName}'s ability.`
                                  : effect.type === 'moveCounterBetweenTargetCreatures'
                                  ? pendingTargetForYou.firstInstanceId
                                    ? `Choose a second creature you control for ${pendingTargetSourceName}'s ability to move the counter onto.`
                                    : `Choose a creature you control with a counter on it for ${pendingTargetSourceName}'s ability to move a counter from.`
                                  : effect.type === 'moveCounterFromOpponentCreatureToOwnCreature'
                                  ? pendingTargetForYou.firstInstanceId
                                    ? `Choose a creature you control for ${pendingTargetSourceName}'s ability to move the counter onto.`
                                    : `Choose a creature an opponent controls with a counter on it for ${pendingTargetSourceName}'s ability to move a counter from.`
                                  : effect.type === 'damageAnyTarget'
                                  ? `Choose any target (a creature or a player) for ${pendingTargetSourceName} to deal ${effect.amount} damage to.`
                                  : effect.type === 'support'
                                  ? `Choose a creature (either player's) for ${pendingTargetSourceName}'s Support to put a +1/+1 counter on (${pendingTargetForYou.remainingPicks ?? 1} left to choose) - or Skip to stop.`
                                  : effect.type === 'grantOnDeathReturnToHandToTarget'
                                  ? `Choose target creature with a counter on it for ${pendingTargetSourceName}'s ability - if it dies this turn, it returns to its owner's hand.`
                                  : effect.type === 'destroyUpToOneOpponentArtifactThenPutCounterOnSelf'
                                  ? `Choose up to one artifact the defending player controls for ${pendingTargetSourceName} to destroy - or Skip.`
                                  : effect.type === 'putOwnCountersOnTargetThenShuffleSelfIntoLibrary'
                                  ? `Choose a creature you control for ${pendingTargetSourceName}'s counters to move onto before it's shuffled into its owner's library.`
                                  : effect.type === 'ronsoRage'
                                  ? `Choose target creature an opponent controls for ${pendingTargetSourceName} to tap.`
                                  : effect.type === 'exileTargetCreatureThenControllerMaySearchBasicLand'
                                  ? `Choose target creature for ${pendingTargetSourceName} to exile.`
                                  : effect.type === 'putTargetNonlandPermanentInLibraryOwnersChoice'
                                  ? `Choose target nonland permanent (either player's) for ${pendingTargetSourceName}'s ability - its owner will choose top or bottom of their library.`
                                  : effect.type === 'grantPreventCombatDamageConvertToCounterToTargetOwnCreature'
                                  ? `Choose a creature you control for ${pendingTargetSourceName}'s ability.`
                                  : effect.type === 'mayMoveAllCountersToTargetCreature'
                                  ? `Choose another creature for ${pendingTargetSourceName}'s ability to move its counters onto - or Skip.`
                                  : effect.type === 'putCounterOnTargetOwnCreatureThenMayPlayHideawayIfCreaturePowerAtLeast'
                                  ? `Choose a creature you control for ${pendingTargetSourceName}'s ability.`
                                  : effect.type === 'moveDeadPermanentCountersToTarget'
                                  ? `Choose a permanent you control for ${pendingTargetSourceName}'s ability to receive the counters.`
                                  : effect.type === 'moveAllCountersBetweenTargetPermanents'
                                  ? pendingTargetForYou.firstInstanceId
                                    ? `Choose a second permanent you control for ${pendingTargetSourceName}'s ability to move the counters onto.`
                                    : `Choose a permanent you control with a counter on it for ${pendingTargetSourceName}'s ability to move counters from.`
                                  : effect.type === 'moveOneCounterFromOwnPermanentToAnyPermanent'
                                  ? pendingTargetForYou.firstInstanceId
                                    ? `Choose a second permanent (either player's) for ${pendingTargetSourceName}'s ability to move the counter onto.`
                                    : `Choose a permanent you control with a counter on it for ${pendingTargetSourceName}'s ability to move a counter from.`
                                  : effect.type === 'gainControlOfTargetNoncreatureArtifactPermanent'
                                  ? `Choose a noncreature artifact (either player's) for ${pendingTargetSourceName} to gain control of.`
                                  : effect.type === 'mayAttachTargetControlledEquipmentToSelf'
                                  ? `Choose an Equipment you control to attach to ${pendingTargetSourceName} - or Skip.`
                                  : effect.type === 'shuffleTargetPermanentIntoLibraryThenRevealTop'
                                  ? `Choose any permanent (either player's) for ${pendingTargetSourceName} to shuffle into its owner's library.`
                                  : effect.type === 'destroyAnyNumberOfTappedCreaturesWithDifferentControllers'
                                  ? `Choose a tapped creature for ${pendingTargetSourceName} to destroy (at most one per controller) - or Skip.`
                                  : effect.type === 'phaseOutAnyNumberOfTargetControlledNonlandPermanents'
                                  ? `Choose a nonland permanent you control for ${pendingTargetSourceName} to phase out - or Skip.`
                                  : effect.type === 'mayBecomeCopyOfAnotherControlledCreatureThenBuffBoth'
                                  ? `Choose another creature you control for ${pendingTargetSourceName} to become a copy of - or Skip.`
                                  : effect.type === 'exileTargetCreatureThenControllerGainsLifeEqualToPower'
                                  ? `Choose target creature for ${pendingTargetSourceName} to exile - its controller gains life equal to its power.`
                                  : effect.type === 'jenovaCellsAttackTrigger'
                                  ? `Choose a creature for ${pendingTargetSourceName} to put a ${effect.counterLabel} counter on - or Skip.`
                                  : effect.type === 'tapTargetThenExileIfMetalcraft'
                                  ? `Choose a creature for ${pendingTargetSourceName} to tap (or exile with Metalcraft).`
                                  : effect.type === 'grantCantBlockToUpToThreeTargets'
                                  ? `Choose up to three creatures for ${pendingTargetSourceName} to stop from blocking this turn - or Skip.`
                                  : effect.type === 'grantIndestructibleToTargetWhileSourceInPlay'
                                  ? `Choose another legendary permanent you control to gain indestructible for as long as you control ${pendingTargetSourceName}.`
                                  : effect.type === 'exileTargetCreatureUntilMonarchChanges'
                                  ? `Choose a creature an opponent controls for ${pendingTargetSourceName} to exile until an opponent becomes the monarch.`
                                  : effect.type === 'exileUpToOneOtherTargetCreatureThenControllerGainsLifeEqualToItsPower'
                                  ? `Choose up to one other creature for ${pendingTargetSourceName} to exile - its controller gains life equal to its power. Or Skip.`
                                  : effect.type === 'pumpTargetOwnCreatureByControlledSubtypeCount'
                                  ? `Choose a creature you control for ${pendingTargetSourceName} to get +X/+0 until end of turn, where X is the number of ${effect.subtype}s you control.`
                                  : effect.type === 'grantKeywordToAnotherTargetAttackingCreature'
                                  ? `Choose another attacking creature to gain ${effect.keyword} until end of turn.`
                                  : effect.type === 'exileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCost'
                                  ? `Choose up to one instant or sorcery card in an opponent's graveyard for ${pendingTargetSourceName} to exile and copy - or Skip.`
                                  : effect.type === 'returnTargetCreatureFromGraveyardWithManaValueEqualTo'
                                  ? `Choose a creature card in your graveyard with mana value ${effect.manaValue} to return to your hand - or Skip.`
                                  : effect.type === 'attachTargetControlledEquipmentToTargetRebel'
                                  ? pendingTargetForYou.firstInstanceId
                                    ? effect.anyControlledCreatureInsteadOfRebel
                                      ? `Choose a creature you control for ${pendingTargetSourceName} to attach that Equipment to - or Skip.`
                                      : `Choose a Rebel you control for ${pendingTargetSourceName} to attach that Equipment to - or Skip.`
                                    : `Choose up to one Equipment you control for ${pendingTargetSourceName} to attach to a creature you control - or Skip.`
                                  : effect.type === 'goadTargetCreature'
                                  ? `Choose a creature an opponent controls for ${pendingTargetSourceName} to goad.`
                                  : effect.type === 'grantIndestructibleToOwnAndOpponentCreatureThenDestroyAll'
                                  ? pendingTargetForYou.firstInstanceId
                                    ? `Choose a creature an opponent controls to gain indestructible, then destroy all creatures.`
                                    : `Choose a creature you control to gain indestructible until end of turn.`
                                  : effect.type === 'damageEqualToGreatestControlledPowerToUpToOneOpponentCreature'
                                  ? `Choose up to one creature an opponent controls for ${pendingTargetSourceName} to damage equal to your greatest power - or Skip.`
                                  : effect.targetFilter === 'artifactOrEnchantment'
                                  ? `Choose an artifact or enchantment for ${pendingTargetSourceName}'s ability (either player's).`
                                  : effect.targetFilter === 'enchantment'
                                  ? `Choose an enchantment for ${pendingTargetSourceName}'s ability (either player's).`
                                  : effect.targetFilter === 'anyPermanent'
                                    ? `Choose any permanent for ${pendingTargetSourceName}'s ability (either player's).`
                                    : effect.targetFilter === 'nonlandPermanent'
                                    ? `Choose a nonland permanent for ${pendingTargetSourceName}'s ability (either player's).`
                                    : effect.targetFilter === 'creatureWithMinPower'
                                    ? `Choose a creature with power ${effect.minPower ?? 0} or greater for ${pendingTargetSourceName}'s ability.`
                                    : effect.targetFilter === 'creatureWithMinToughness'
                                    ? `Choose a creature with toughness ${effect.minToughness ?? 0} or greater for ${pendingTargetSourceName}'s ability.`
                                    : effect.targetFilter === 'creatureWithDamageMarked'
                                    ? `Choose a creature that was dealt damage this turn for ${pendingTargetSourceName}'s ability.`
                                    : effect.targetFilter === 'land'
                                    ? `Choose a land for ${pendingTargetSourceName}'s ability (either player's).`
                                    : effect.targetFilter === 'creature'
                                    ? `Choose a creature for ${pendingTargetSourceName}'s ability (either player's).`
                                    : `Choose a target for ${pendingTargetSourceName}'s ability - click an artifact, enchantment, or creature with flying (either player's).`;
          return (
            <div className="pending-target-banner">
              <span>{text}</span>
              {((effect.type === 'selfFightTarget' && effect.optional) ||
                (effect.type === 'destroyTarget' && effect.optional) ||
                (effect.type === 'putCounterOnTarget' && effect.optional) ||
                (effect.type === 'attachSelfToTarget' && effect.optional) ||
                effect.type === 'putCounterOnUpToOneOwnCreature' ||
                effect.type === 'bounceUpToOneOtherNonlandPermanent' ||
                effect.type === 'putCounterOnUpToOneOtherCreatureEqualToOwnPower' ||
                effect.type === 'tapStunAndGainLifeForNonbasicLands' ||
                effect.type === 'attachAllControlledEquipmentToTargetCreature' ||
                effect.type === 'mayAttachTargetControlledEquipmentToSelf' ||
                effect.type === 'attachTargetControlledEquipmentToTargetRebel' ||
                effect.type === 'destroyAnyNumberOfTappedCreaturesWithDifferentControllers' ||
                effect.type === 'phaseOutAnyNumberOfTargetControlledNonlandPermanents' ||
                effect.type === 'mayBecomeCopyOfAnotherControlledCreatureThenBuffBoth' ||
                effect.type === 'jenovaCellsAttackTrigger' ||
                effect.type === 'exileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCost' ||
                effect.type === 'returnTargetCreatureFromGraveyardWithManaValueEqualTo' ||
                effect.type === 'exileUpToOneOtherTargetCreatureThenControllerGainsLifeEqualToItsPower' ||
                (effect.type === 'grantKeywordsToTargetPermanent' && effect.optional) ||
                (effect.type === 'pumpUpToTwoTargets' && !!pendingTargetForYou.firstInstanceId)) && (
                <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'CHOOSE_TARGET', targetInstanceId: null }, pendingTargetForYou.controllerId)}>
                  Skip
                </button>
              )}
            </div>
          );
        })()}

      {pendingSacrificeForYou &&
        (() => {
          const filter = pendingSacrificeForYou.filter;
          const label = filter === 'creature' ? 'creature' : filter === 'creatureToken' ? 'creature token' : filter === 'nontokenCreature' ? 'nontoken creature' : 'enchantment';
          return (
            <div className="pending-target-banner">
              <span>Choose a {label} to sacrifice.</span>
            </div>
          );
        })()}

      {pendingKeepOneSacrificeRestForYou && (
        <div className="pending-target-banner">
          <span>Choose a creature you control to keep - the rest will be sacrificed and it gets a vow counter.</span>
        </div>
      )}

      {pendingSacrificeCost && (
        <div className="pending-target-banner">
          <span>
            Choose {pendingSacrificeCost.count === 1 ? 'another' : `${pendingSacrificeCost.count}`}{' '}
            {pendingSacrificeCost.filter === 'artifactOrCreature' ? 'creature(s) or artifact(s)' : `${pendingSacrificeCost.filter}(s)`} you control to sacrifice
            {pendingSacrificeCost.count > 1 ? ` (${pendingSacrificeCost.selected.length}/${pendingSacrificeCost.count} chosen)` : ''}.
          </span>
          <button className="opponent-view-exit-button" onClick={() => setPendingSacrificeCost(null)}>
            Cancel
          </button>
        </div>
      )}

      {pendingCounterRemovalCost && (
        <div className="pending-target-banner">
          <span>Choose a nonland permanent you control with a counter on it to remove one from.</span>
          <button className="opponent-view-exit-button" onClick={() => setPendingCounterRemovalCost(null)}>
            Cancel
          </button>
        </div>
      )}

      {pendingEscalateCost && (
        <div className="pending-target-banner">
          <span>
            Escalate: tap {pendingEscalateCost.count} untapped creature(s) you control ({pendingEscalateCost.selected.length}/{pendingEscalateCost.count} chosen).
          </span>
          <button className="opponent-view-exit-button" onClick={() => setPendingEscalateCost(null)}>
            Cancel
          </button>
        </div>
      )}

      {pendingCrew && (
        <div className="pending-target-banner">
          <span>
            Crew {pendingCrew.crewCost}: click untapped creatures you control to add/remove them ({pendingCrew.selected.length} selected).
          </span>
          <button
            className="opponent-view-exit-button"
            disabled={pendingCrew.selected.length === 0}
            onClick={() => {
              onAction({ type: 'CREW_VEHICLE', instanceId: pendingCrew.instanceId, crewInstanceIds: pendingCrew.selected }, pendingCrew.ownerId);
              setPendingCrew(null);
            }}
          >
            Confirm Crew
          </button>
          <button className="opponent-view-exit-button" onClick={() => setPendingCrew(null)}>
            Cancel
          </button>
        </div>
      )}

      {pendingConvokeCast && (
        <div className="pending-target-banner">
          <span>
            Convoke: click untapped creatures you control to tap them toward this cost ({pendingConvokeCast.selected.length} selected).
          </span>
          <button
            className="opponent-view-exit-button"
            onClick={() => {
              onAction({ type: 'CAST_CARD', instanceId: pendingConvokeCast.instanceId, convokeInstanceIds: pendingConvokeCast.selected }, pendingConvokeCast.ownerId);
              setPendingConvokeCast(null);
              setOpenPanelId(null);
            }}
          >
            Cast
          </button>
          <button className="opponent-view-exit-button" onClick={() => setPendingConvokeCast(null)}>
            Cancel
          </button>
        </div>
      )}

      {state.pendingOptionalDiscardHandForDevotion &&
        (state.pendingOptionalDiscardHandForDevotion.controllerId === yourPlayerId || soloControl) && (
          <div className="pending-target-banner">
            <span>You may discard your hand, then draw cards equal to your devotion to {state.pendingOptionalDiscardHandForDevotion.color}.</span>
            <button
              className="opponent-view-exit-button"
              onClick={() => onAction({ type: 'RESOLVE_OPTIONAL_DISCARD_HAND_FOR_DEVOTION', accept: true }, state.pendingOptionalDiscardHandForDevotion!.controllerId)}
            >
              Discard &amp; Draw
            </button>
            <button
              className="opponent-view-exit-button"
              onClick={() => onAction({ type: 'RESOLVE_OPTIONAL_DISCARD_HAND_FOR_DEVOTION', accept: false }, state.pendingOptionalDiscardHandForDevotion!.controllerId)}
            >
              Skip
            </button>
          </div>
        )}

      {state.pendingOptionalTransform &&
        !showCombatZones &&
        (state.pendingOptionalTransform.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingOptionalTransform;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This permanent';
          return (
            <div className="pending-target-banner">
              <span>You may exile {sourceName}, then return it to the battlefield transformed.</span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_OPTIONAL_TRANSFORM', accept: true }, pending.controllerId)}>
                Transform
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_OPTIONAL_TRANSFORM', accept: false }, pending.controllerId)}>
                Skip
              </button>
            </div>
          );
        })()}

      {state.pendingOptionalBecomeCopy &&
        !showCombatZones &&
        (state.pendingOptionalBecomeCopy.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingOptionalBecomeCopy;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This creature';
          const copyName = getCardDefinition(pending.copyDefId).name;
          return (
            <div className="pending-target-banner">
              <span>You may have {sourceName} become a copy of {copyName}'s power and toughness (it keeps its own name and abilities).</span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_OPTIONAL_BECOME_COPY', accept: true }, pending.controllerId)}>
                Become a Copy
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_OPTIONAL_BECOME_COPY', accept: false }, pending.controllerId)}>
                Skip
              </button>
            </div>
          );
        })()}

      {state.pendingLibraryPlacementChoice &&
        !showCombatZones &&
        (state.pendingLibraryPlacementChoice.ownerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingLibraryPlacementChoice;
          const targetFound = findCard(state, pending.targetInstanceId);
          const targetName = targetFound ? getCardDefinition(targetFound.card.defId).name : 'This permanent';
          return (
            <div className="pending-target-banner">
              <span>Put {targetName} on the top or bottom of your library.</span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_LIBRARY_PLACEMENT_CHOICE', toTop: true }, pending.ownerId)}>
                Top
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_LIBRARY_PLACEMENT_CHOICE', toTop: false }, pending.ownerId)}>
                Bottom
              </button>
            </div>
          );
        })()}

      {state.pendingWardPayment &&
        (state.pendingWardPayment.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingWardPayment;
          const wardedFound = findCard(state, pending.targetInstanceId);
          const wardedName = wardedFound ? getCardDefinition(wardedFound.card.defId).name : 'That permanent';
          const sourceFound = state.pendingTarget ? findCard(state, state.pendingTarget.sourceInstanceId) : null;
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const costLabel = pending.cost.mana
            ? `Pay {${pending.cost.mana}}`
            : wardedFound
              ? `Pay ${effectivePower(getCardDefinition(wardedFound.card.defId), wardedFound.card, state, pending.wardOwnerId)} Life`
              : 'Pay Ward’s cost';
          return (
            <div className="pending-target-banner">
              <span>
                {wardedName} has Ward - {sourceName} is countered unless you pay its cost.
              </span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_WARD_PAYMENT', pay: true }, pending.controllerId)}>
                {costLabel}
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_WARD_PAYMENT', pay: false }, pending.controllerId)}>
                Decline (Countered)
              </button>
            </div>
          );
        })()}

      {state.pendingAttackTaxPayment &&
        (state.pendingAttackTaxPayment.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingAttackTaxPayment;
          return (
            <div className="pending-target-banner">
              <span>
                Creatures can't attack unless you pay {`{${pending.totalGeneric}}`} total for {pending.instanceIds.length} attacker(s).
              </span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_ATTACK_TAX_PAYMENT', pay: true }, pending.controllerId)}>
                Pay {`{${pending.totalGeneric}}`}
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_ATTACK_TAX_PAYMENT', pay: false }, pending.controllerId)}>
                Decline (No Attackers)
              </button>
            </div>
          );
        })()}

      {state.pendingRhysticDrawPayment &&
        (state.pendingRhysticDrawPayment.payerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingRhysticDrawPayment;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'That permanent';
          const controllerName = state.players.find((p) => p.id === pending.controllerId)?.name ?? 'Its controller';
          return (
            <div className="pending-target-banner">
              <span>
                {sourceName}: {controllerName} draws a card unless you pay {`{${pending.cost}}`}.
              </span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_RHYSTIC_DRAW_PAYMENT', pay: true }, pending.payerId)}>
                Pay {`{${pending.cost}}`}
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_RHYSTIC_DRAW_PAYMENT', pay: false }, pending.payerId)}>
                Decline (They Draw)
              </button>
            </div>
          );
        })()}

      {pendingCounterTransferForYou && (
        <div className="pending-target-banner">
          <span>
            {pendingCounterTransferForYou.sourceName}: you may put {pendingCounterTransferForYou.amount} +1/+1 counter(s) on target creature.
          </span>
          <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_COUNTER_TRANSFER', targetInstanceId: null }, pendingCounterTransferForYou.controllerId)}>
            Skip
          </button>
        </div>
      )}

      {state.pendingOptionalPayLife &&
        (state.pendingOptionalPayLife.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingOptionalPayLife;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This permanent';
          return (
            <div className="pending-target-banner">
              <span>
                {sourceName}: you may pay {pending.lifeCost} life.
              </span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_OPTIONAL_PAY_LIFE', accept: true }, pending.controllerId)}>
                Pay {pending.lifeCost} Life
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_OPTIONAL_PAY_LIFE', accept: false }, pending.controllerId)}>
                Skip
              </button>
            </div>
          );
        })()}

      {state.pendingThrowWideTheGatesChoice &&
        (state.pendingThrowWideTheGatesChoice.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingThrowWideTheGatesChoice;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This permanent';
          return (
            <div className="pending-target-banner">
              <span>
                {sourceName}: you may pay {pending.manaValue} life to create a Hero token with {pending.manaValue} +1/+1 counter(s).
              </span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_THROW_WIDE_THE_GATES', accept: true }, pending.controllerId)}>
                Pay {pending.manaValue} Life
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_THROW_WIDE_THE_GATES', accept: false }, pending.controllerId)}>
                Skip
              </button>
            </div>
          );
        })()}

      {state.pendingSnortChoice &&
        (state.pendingSnortChoice.pendingPlayerIds[0] === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingSnortChoice;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This spell';
          const decider = pending.pendingPlayerIds[0];
          return (
            <div className="pending-target-banner">
              <span>
                {sourceName}: you may discard your hand and draw {pending.drawCount} cards (then take {pending.damageAmount} damage if you do).
              </span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_SNORT_CHOICE', accept: true }, decider)}>
                Discard &amp; Draw {pending.drawCount}
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_SNORT_CHOICE', accept: false }, decider)}>
                Skip
              </button>
            </div>
          );
        })()}

      {state.pendingKefkaChoice &&
        (state.pendingKefkaChoice.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingKefkaChoice;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const eligible = state.players
            .flatMap((p) => p.zones.exile)
            .filter((c) => pending.eligibleInstanceIds.includes(c.instanceId) && getCardDefinition(c.defId).type !== 'land');
          return (
            <ReturnFromGraveyardModal
              sourceName={sourceName}
              title="Cast for free?"
              description="Choose a card exiled this way to cast without paying its mana cost - its owner then loses life equal to its mana value."
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_KEFKA_CHOICE', instanceId }, pending.controllerId)}
              onCancel={() => onAction({ type: 'RESOLVE_KEFKA_CHOICE', instanceId: null }, pending.controllerId)}
            />
          );
        })()}

      {state.pendingMayPutTopLandOntoBattlefieldTapped &&
        (state.pendingMayPutTopLandOntoBattlefieldTapped.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingMayPutTopLandOntoBattlefieldTapped;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This permanent';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const topCard = controller.zones.library[0];
          const topName = topCard ? getCardDefinition(topCard.defId).name : 'it';
          return (
            <div className="pending-target-banner">
              <span>
                {sourceName}: the top card of your library is {topName} - you may put it onto the battlefield tapped.
              </span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_MAY_PUT_TOP_LAND_ONTO_BATTLEFIELD_TAPPED', accept: true }, pending.controllerId)}>
                Put Onto Battlefield
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_MAY_PUT_TOP_LAND_ONTO_BATTLEFIELD_TAPPED', accept: false }, pending.controllerId)}>
                Skip
              </button>
            </div>
          );
        })()}

      {state.pendingMayEffect &&
        (state.pendingMayEffect.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingMayEffect;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This permanent';
          return (
            <div className="pending-target-banner">
              <span>{sourceName}: you may.</span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_MAY_EFFECT', accept: true }, pending.controllerId)}>
                Yes
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_MAY_EFFECT', accept: false }, pending.controllerId)}>
                Skip
              </button>
            </div>
          );
        })()}

      {state.pendingCommanderZoneChoice &&
        (state.pendingCommanderZoneChoice.ownerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingCommanderZoneChoice;
          const def = getCardDefinition(pending.destinationCard.defId);
          const destinationLabel = pending.destinationZone.charAt(0).toUpperCase() + pending.destinationZone.slice(1);
          return (
            <div className="pending-target-banner">
              <span>
                {def.name}: send Commander to Command Zone or {destinationLabel}?
              </span>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_COMMANDER_ZONE_CHOICE', toCommandZone: true }, pending.ownerId)}>
                Command Zone
              </button>
              <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'RESOLVE_COMMANDER_ZONE_CHOICE', toCommandZone: false }, pending.ownerId)}>
                {destinationLabel}
              </button>
            </div>
          );
        })()}

      {state.pendingGraveyardExile &&
        (() => {
          const pending = state.pendingGraveyardExile;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const eligible = state.players
            .flatMap((p) => p.zones.graveyard)
            .filter((c) => {
              const d = getCardDefinition(c.defId);
              return (!pending.creatureOnly || d.type === 'creature') && (!pending.instantOrSorceryOnly || d.type === 'instant' || d.type === 'sorcery');
            });
          const exileDescription = pending.creatureOnly
            ? "Choose a creature card in either graveyard to exile, or Skip."
            : pending.instantOrSorceryOnly
              ? 'Choose an instant or sorcery card in either graveyard to exile, or Skip.'
              : "Choose a card in either graveyard to exile.";
          return (
            <ReturnFromGraveyardModal
              sourceName={sourceName}
              title="Exile a card"
              description={exileDescription}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_GRAVEYARD_EXILE', instanceId }, pending.controllerId)}
              onCancel={pending.optional ? () => onAction({ type: 'RESOLVE_GRAVEYARD_EXILE', instanceId: null }, pending.controllerId) : undefined}
            />
          );
        })()}

      {state.pendingDiscardUpToThenDraw &&
        (state.pendingDiscardUpToThenDraw.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingDiscardUpToThenDraw;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const remaining = pending.maxCount - pending.discardedSoFar;
          return (
            <ReturnFromGraveyardModal
              sourceName={sourceName}
              title={`Discard up to ${remaining} more`}
              description="Choose a card from your hand to discard, then stop whenever you like."
              cards={controller.zones.hand.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'DISCARD_UP_TO_THEN_DRAW', instanceId }, pending.controllerId)}
              onCancel={() => onAction({ type: 'DISCARD_UP_TO_THEN_DRAW', instanceId: null }, pending.controllerId)}
            />
          );
        })()}

      <div className="docked-hand-tray">{renderHandRow(you, false, true)}</div>

      {effectiveViewMode === 'full' ? (
        (() => {
          const opponentPieces = buildPlayerZonePieces(opponent, true, true, true);
          const yourPieces = buildPlayerZonePieces(you, false, false, true, true);
          return (
            <div className={`full-board-grid ${showCombatZones ? 'full-board-combat' : ''}`}>
              {/* Commander/library-graveyard-exile corner lives outside the
                  scaled area entirely, on sticky rails - zooming the middle
                  to fit both boards can no longer drag it in from the true
                  screen edges, since it's never part of what's being scaled.
                  Both rails render now - each one collapses independently
                  (see collapsedCorners), so you can peek at or hide either
                  side's commander/library/graveyard/exile whenever you want
                  instead of the opponent's being unconditionally hidden. */}
              <div className="full-board-side-rail">{opponentPieces.cornerColumn}</div>
              {renderZoomedBoard(
                <>
                  <section className="player-zone opponent-zone">
                    {opponentPieces.lifeRow}
                    {opponentPieces.handRow}
                    <div className="zone-top-row">{opponentPieces.centerColumn}</div>
                  </section>
                  {combatZoneEl}
                  <section className="player-zone your-zone">
                    <div className="zone-top-row">{yourPieces.centerColumn}</div>
                    {yourPieces.handRow}
                    {yourPieces.lifeRow}
                  </section>
                </>,
              )}
              <div className="full-board-side-rail">{yourPieces.cornerColumn}</div>
            </div>
          );
        })()
      ) : effectiveViewMode === 'mine' ? (
        // Just your own battlefield, full-screen - no opponent zone to
        // scroll past to reach it. Full Board is still there (and forced
        // during combat) for whenever both boards actually need to be visible at once.
        renderZoomedBoard(renderPlayerZone(you, false, false))
      ) : (
        // Opponent View: their battlefield, laid out the way they'd see it
        // (mirrorLayout false) rather than mirrored across the table -
        // isOpponentSide stays true so their hand still only shows a count
        // (see renderHandRow) and their permanents stay look-only.
        renderZoomedBoard(renderPlayerZone(opponent, true, false))
      )}

      {/* Pinned to the screen (not in normal flow) while editing, so it's
          always reachable regardless of scroll position - Done dismisses it.
          Whichever view is active gets its own zoom (see zoomByMode above). */}
      {editingZoom && (
        <div className="full-board-zoom-dock">
          <button
            className="full-board-zoom-button"
            disabled={fullBoardZoom <= MIN_FULL_BOARD_ZOOM}
            onClick={() => setFullBoardZoom((z) => Math.max(MIN_FULL_BOARD_ZOOM, +(z - FULL_BOARD_ZOOM_STEP).toFixed(2)))}
            title="Zoom out"
          >
            −
          </button>
          <input
            className="full-board-zoom-input"
            type="number"
            min={Math.round(MIN_FULL_BOARD_ZOOM * 100)}
            max={Math.round(MAX_FULL_BOARD_ZOOM * 100)}
            value={Math.round(fullBoardZoom * 100)}
            onChange={(e) => {
              const pct = parseInt(e.target.value, 10);
              if (Number.isNaN(pct)) return;
              setFullBoardZoom(Math.min(MAX_FULL_BOARD_ZOOM, Math.max(MIN_FULL_BOARD_ZOOM, pct / 100)));
            }}
          />
          <span className="full-board-zoom-level">%</span>
          <button
            className="full-board-zoom-button"
            disabled={fullBoardZoom >= MAX_FULL_BOARD_ZOOM}
            onClick={() => setFullBoardZoom((z) => Math.min(MAX_FULL_BOARD_ZOOM, +(z + FULL_BOARD_ZOOM_STEP).toFixed(2)))}
            title="Zoom in"
          >
            +
          </button>
          <button className="view-mode-button" onClick={() => setEditingZoom(false)}>
            Done
          </button>
        </div>
      )}

      {/* Pinned bottom-left, Event Log then Board View to its right - the
          hand now lives permanently in the docked tray, so Mutual
          Adjustment/Concede/View options moved here rather than sitting in
          normal document flow where the hand used to leave room for them. */}
      <div className="bottom-left-stack">
        <EventLog log={state.log} />

        <div className="board-view-column">
          {/* Only during someone else's turn - a quick way to flip to
              Opponent View and watch it happen, without opening Board View
              and clicking through to it yourself. Once more than two
              players are ever in a game, this is the shape a "watch player
              N's turn" shortcut would take for each of them too. */}
          {state.activePlayerId !== yourPlayerId && (
            <button
              className={`opponent-turn-eye ${viewMode === 'opponent' ? 'opponent-turn-eye-active' : ''}`}
              disabled={showCombatZones}
              title={
                showCombatZones
                  ? 'Combat shows the full board until it resolves'
                  : viewMode === 'opponent'
                    ? 'Click to stop watching (back to My View)'
                    : "Opponent's turn - click to watch (Opponent View)"
              }
              onClick={() => changeViewMode(viewMode === 'opponent' ? 'mine' : 'opponent')}
            >
              {'\u{1F441}'}
            </button>
          )}
          <div className={`board-view-panel-float ${boardViewExpanded ? 'board-view-panel-expanded' : ''}`}>
            <button className="board-view-panel-header" onClick={() => setBoardViewExpanded((e) => !e)}>
              {boardViewExpanded ? 'Board View ▾' : 'Board View ▴'}
            </button>
            {boardViewExpanded && (
              <div className="board-view-panel-body">
                <div className="view-mode-toggle">
                  <button
                    className={`view-mode-button ${viewMode === 'mine' ? 'view-mode-button-active' : ''}`}
                    disabled={showCombatZones}
                    title={showCombatZones ? 'Combat shows the full board until it resolves' : ''}
                    onClick={() => changeViewMode('mine')}
                  >
                    My View
                  </button>
                  <button
                    className={`view-mode-button ${viewMode === 'opponent' ? 'view-mode-button-active' : ''}`}
                    disabled={showCombatZones}
                    title={showCombatZones ? 'Combat shows the full board until it resolves' : ''}
                    onClick={() => changeViewMode('opponent')}
                  >
                    Opponent View
                  </button>
                  <button className={`view-mode-button ${viewMode === 'full' ? 'view-mode-button-active' : ''}`} onClick={() => changeViewMode('full')}>
                    Full Board
                  </button>
                  {/* My View/Opponent View fit themselves automatically now (see
                      autoFitZoom) - there's nothing left for a manual zoom to do
                      until Full Board is actually showing both boards. */}
                  {effectiveViewMode === 'full' && (
                    <button className="view-mode-button" onClick={() => setEditingZoom(true)}>
                      Edit View
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="bottom-right-controls"
        onMouseDown={startPhaseDrag}
        style={phaseBoxPos ? { left: phaseBoxPos.x, top: phaseBoxPos.y, right: 'auto', bottom: 'auto' } : undefined}
      >
        <div className="turn-box-row">
          <button
            className="turn-extras-toggle"
            onClick={() => setTurnExtrasExpanded((v) => !v)}
            title={turnExtrasExpanded ? 'Hide Mutual Adjustment/Concede' : 'Mutual Adjustment/Concede'}
            aria-label={turnExtrasExpanded ? 'Hide Mutual Adjustment/Concede' : 'Mutual Adjustment/Concede'}
          >
            {'▲'}
          </button>
          <PhaseBar
            phase={state.phase}
            turnNumber={state.turnNumber}
            isYourTurn={isYourTurn || state.phase === 'combat_damage'}
            nextLabel={nextLabel}
            hideEndTurn={isDeclaringAttackers || isDeclaringBlockers || isWaitingOnBlockers || state.phase === 'combat_damage'}
            nextDisabled={isWaitingOnBlockers || (state.phase === 'combat_damage' && youAreReadyForCombat)}
            onNextPhase={() => {
              if (isDeclaringAttackers) confirmAttackers();
              else if (isDeclaringBlockers) confirmBlockers();
              else if (isWaitingOnBlockers) return;
              else onAction({ type: 'NEXT_PHASE' }, yourPlayerId);
            }}
            onEndTurn={() => onAction({ type: 'END_TURN' }, state.activePlayerId)}
          />
        </div>
        {turnExtrasExpanded && (
          <div className="turn-extras-panel">
            <MutualAdjustmentControls
              state={state}
              yourPlayerId={yourPlayerId}
              onRequest={() => onAction({ type: 'REQUEST_MUTUAL_ADJUSTMENT' }, yourPlayerId)}
              onRespond={(accept) => onAction({ type: 'RESPOND_MUTUAL_ADJUSTMENT', accept }, yourPlayerId)}
              onRequestExit={() => onAction({ type: 'REQUEST_EXIT_MUTUAL_ADJUSTMENT' }, yourPlayerId)}
              onRespondExit={(accept) => onAction({ type: 'RESPOND_EXIT_MUTUAL_ADJUSTMENT', accept }, yourPlayerId)}
            />
            {/* Hold rather than click - see startConcedeHold - so an
                accidental tap never ends the game outright. Still a 3s
                hold, just relabeled to fit this smaller panel. */}
            <button
              className="concede-button"
              onMouseDown={startConcedeHold}
              onMouseUp={cancelConcedeHold}
              onMouseLeave={cancelConcedeHold}
              onTouchStart={startConcedeHold}
              onTouchEnd={cancelConcedeHold}
              onTouchCancel={cancelConcedeHold}
            >
              <span
                className="concede-button-fill"
                style={{ width: concedeHolding ? '100%' : '0%', transitionDuration: concedeHolding ? `${CONCEDE_HOLD_MS}ms` : '0s' }}
              />
              <span className="concede-button-label">Concede</span>
            </button>
          </div>
        )}
        {phaseBoxPos && (
          <button className="phase-bar-compact-button secondary reset-position-button" onClick={() => setPhaseBoxPos(null)}>
            Reset turn box location
          </button>
        )}
      </div>

      {openCard && (() => {
        // For an exile-play grant, every "can I afford/is it my turn" check
        // below needs to read the GRANT HOLDER's state (mana, land drops,
        // phase), not the exiled card's owner - they can be different
        // players (Reno and Rude). Every other zone (hand/battlefield/
        // graveyard/...) never has this split, so it's always just
        // openCard.player there.
        const exilePlayActingPlayer = openCardExilePlayGrant ? state.players.find((p) => p.id === yourPlayerId)! : openCard.player;
        // "...cast a permanent spell of each permanent type from your
        // graveyard" (Orphan, Cocoon fal'Cie) - mirrors castFromGraveyard's
        // own useMuldrothaGrant eligibility check: the card's own graveyard,
        // not flashback, a creature/artifact/enchantment, that TYPE not
        // already used this turn, and a Muldrotha-style permanent on the
        // controller's battlefield.
        const openCardDef = getCardDefinition(openCard.card.defId);
        const canCastFromGraveyardHere =
          openCard.zone === 'graveyard' &&
          !openCardDef.flashback &&
          (openCardDef.type === 'creature' || openCardDef.type === 'artifact' || openCardDef.type === 'enchantment') &&
          !(openCard.player.graveyardCastTypesUsedThisTurn ?? []).includes(openCardDef.type) &&
          openCard.player.zones.battlefield.some((c) => getCardDefinition(c.defId).grantsCastPermanentFromOwnGraveyardOncePerTypeEachTurn);
        return (
        <CardActionsPanel
          definition={getCardDefinition(openCard.card.defId)}
          instance={openCard.card}
          canCastFromGraveyardHere={canCastFromGraveyardHere}
          currentZone={openCard.zone}
          readOnly={openCardIsReadOnly}
          ownerManaPool={exilePlayActingPlayer.manaPool}
          ownerLife={exilePlayActingPlayer.life}
          ownerCommanderDefId={openCard.player.commanderDefId}
          mutualActive={mutualActive}
          isMyTurn={state.activePlayerId === exilePlayActingPlayer.id}
          isMyEndStep={state.phase === 'end' && state.activePlayerId === openCard.player.id}
          isMyFirstMainPhase={state.phase === 'main1' && state.activePlayerId === openCard.player.id}
          isMyUpkeep={state.phase === 'upkeep' && state.activePlayerId === openCard.player.id}
          isMyMainPhase={(state.phase === 'main1' || state.phase === 'main2') && state.activePlayerId === openCard.player.id}
          ownerGraveyardCount={openCard.player.zones.graveyard.length}
          ownerLegendaryCreatureCount={
            openCard.player.zones.battlefield.filter((c) => {
              const d = getCardDefinition(c.defId);
              return d.type === 'creature' && d.subtype?.toLowerCase().includes('legendary');
            }).length
          }
          costReduction={dynamicCostReduction(getCardDefinition(openCard.card.defId), openCard.player)}
          costReductionSources={costReductionSourcesFor(getCardDefinition(openCard.card.defId), openCard.player)}
          ownerBattlefieldDefIds={openCard.player.zones.battlefield.map((c) => c.defId)}
          exilePlayGrant={openCardExilePlayGrant}
          libraryTopPlayAllowed={openCardLibraryTopPlayAllowed}
          alreadyPlayedLand={
            exilePlayActingPlayer.landsPlayedThisTurn >=
            1 + exilePlayActingPlayer.zones.battlefield.reduce((sum, c) => sum + (getCardDefinition(c.defId).extraLandsPerTurn ?? 0), 0)
          }
          revealedCards={
            openCard.zone === 'battlefield' && openCard.card.revealedCardIds && openCard.card.revealedCardIds.length > 0
              ? openCard.card.revealedCardIds
                  .map((id) => {
                    const found = findCard(state, id);
                    return found ? { instanceId: id, defId: found.card.defId, stillInHand: found.zone === 'hand' } : null;
                  })
                  .filter((rc): rc is { instanceId: string; defId: string; stillInHand: boolean } => rc !== null)
              : undefined
          }
          equipmentContributions={
            openCard.zone === 'battlefield' ? equipmentContributions(state, openCard.player.id, openCard.card.instanceId) : undefined
          }
          cycleGroup={openCardCycleGroup}
          onCycleTo={(instanceId) => setOpenPanelId(instanceId)}
          attachedToName={
            openCard.card.attachedToInstanceId ? getCardDefinition(findCard(state, openCard.card.attachedToInstanceId)?.card.defId ?? '')?.name ?? null : null
          }
          manaOptions={manaTapOptions(getCardDefinition(openCard.card.defId), openCard.card) ?? undefined}
          tapDisabledReason={tapDisabledReason(getCardDefinition(openCard.card.defId), openCard.card, openCard.player)}
          canTapForMana={hasPlainTapUse(getCardDefinition(openCard.card.defId), openCard.card)}
          onToggleTap={() => {
            onAction({ type: 'TOGGLE_TAP', instanceId: openCard.card.instanceId });
            setOpenPanelId(null);
          }}
          onChooseTapColor={(color) => {
            onAction({ type: 'TOGGLE_TAP', instanceId: openCard.card.instanceId, chosenColor: color });
            setOpenPanelId(null);
          }}
          onCast={() => handleCast(openCard.card)}
          onActivateAbility={(abilityId) => {
            const ability = getCardDefinition(openCard.card.defId).abilities?.find((a) => a.id === abilityId);
            if (ability?.cost.sacrificeAnother) {
              setPendingSacrificeCost({
                instanceId: openCard.card.instanceId,
                abilityId,
                ownerId: openCard.player.id,
                filter: ability.cost.sacrificeAnother,
                count: ability.cost.sacrificeAnotherCount ?? 1,
                selected: [],
              });
              setOpenPanelId(null);
            } else if (ability?.cost.removeCounterFromAnotherPermanent) {
              setPendingCounterRemovalCost({ instanceId: openCard.card.instanceId, abilityId, ownerId: openCard.player.id });
              setOpenPanelId(null);
            } else {
              onAction({ type: 'ACTIVATE_ABILITY', instanceId: openCard.card.instanceId, abilityId });
            }
          }}
          onMove={(toZone) => {
            onAction({ type: 'MOVE_CARD', instanceId: openCard.card.instanceId, toZone });
            setOpenPanelId(null);
          }}
          onAdjustCounter={(label, delta) => onAction({ type: 'ADJUST_COUNTER', instanceId: openCard.card.instanceId, label, delta })}
          onStartAttach={() => {
            setPendingAttach({ instanceId: openCard.card.instanceId, ownerId: openCard.player.id });
            setOpenPanelId(null);
          }}
          onDetach={() => {
            onAction({ type: 'DETACH_CARD', instanceId: openCard.card.instanceId });
            setOpenPanelId(null);
          }}
          onStartCrew={() => {
            const def = getCardDefinition(openCard.card.defId);
            setPendingCrew({ instanceId: openCard.card.instanceId, ownerId: openCard.player.id, crewCost: def.crew!, selected: [] });
            setOpenPanelId(null);
          }}
          onCycle={() => {
            onAction({ type: 'CYCLE_CARD', instanceId: openCard.card.instanceId });
            setOpenPanelId(null);
          }}
          onFlashback={() => {
            onAction({ type: 'CAST_FROM_GRAVEYARD', instanceId: openCard.card.instanceId });
            setOpenPanelId(null);
          }}
          onPlayFromExile={() => {
            onAction({ type: 'CAST_FROM_EXILE', instanceId: openCard.card.instanceId });
            setOpenPanelId(null);
          }}
          onPlayFromLibraryTop={() => {
            onAction({ type: 'CAST_FROM_LIBRARY_TOP', instanceId: openCard.card.instanceId });
            setOpenPanelId(null);
          }}
          onClose={() => setOpenPanelId(null)}
        />
        );
      })()}

      {openZone &&
        (() => {
          const zonePlayer = state.players.find((p) => p.id === openZone.playerId)!;
          const isYou = zonePlayer.id === yourPlayerId;
          return (
            <ZoneModal
              title={(isYou ? 'Your' : `${zonePlayer.name}'s`) + ' ' + openZone.zone}
              cards={zonePlayer.zones[openZone.zone]}
              onClose={() => setOpenZone(null)}
              onCardClick={(instanceId) => {
                setOpenZone(null);
                setOpenPanelId(instanceId);
              }}
            />
          );
        })()}

      {openBlockerPile &&
        (() => {
          const attackerFound = findCard(state, openBlockerPile);
          const blockerIds = blockersFor(openBlockerPile);
          if (!attackerFound || blockerIds.length === 0) return null;
          const blockers = blockerIds
            .map((id) => findCard(state, id))
            .filter((b): b is NonNullable<typeof b> => !!b)
            .map((b) => ({ definition: getCardDefinition(b.card.defId), instance: b.card }));
          return (
            <BlockerPileModal
              attackerName={getCardDefinition(attackerFound.card.defId).name}
              blockers={blockers}
              onRemove={
                isDeclaringBlockers
                  ? (instanceId) => {
                      removeBlockerAssignment(openBlockerPile, instanceId);
                      if (blockerIds.length <= 1) setOpenBlockerPile(null);
                    }
                  : undefined
              }
              onClose={() => setOpenBlockerPile(null)}
            />
          );
        })()}

      {attackerNeedingOrder &&
        (() => {
          const attackerFound = findCard(state, attackerNeedingOrder.attackerInstanceId);
          if (!attackerFound) return null;
          const blockers = attackerNeedingOrder.blockerInstanceIds
            .map((id) => findCard(state, id))
            .filter((b): b is NonNullable<typeof b> => !!b)
            .map((b) => ({ definition: getCardDefinition(b.card.defId), instance: b.card }));
          return (
            <BlockOrderModal
              attackerDefinition={getCardDefinition(attackerFound.card.defId)}
              attackerInstance={attackerFound.card}
              blockers={blockers}
              onConfirm={(orderedBlockerIds) => {
                onAction({ type: 'ORDER_BLOCKERS', attackerInstanceId: attackerNeedingOrder.attackerInstanceId, orderedBlockerIds }, state.activePlayerId);
                setOrderedAttackerIds((prev) => new Set(prev).add(attackerNeedingOrder.attackerInstanceId));
              }}
            />
          );
        })()}

      {state.pendingReveal &&
        (() => {
          const pending = state.pendingReveal;
          const step = pending.steps[pending.stepIndex];
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This spell';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const opponentOfSource = state.players.find((p) => p.id !== pending.controllerId)!;
          const expectedChooserId = !step ? null : step.chooser === 'you' ? pending.controllerId : opponentOfSource.id;
          const isYourChoice = !!expectedChooserId && (expectedChooserId === yourPlayerId || !!soloControl);
          const chooserName = expectedChooserId === controller.id ? controller.name : opponentOfSource.name;
          const destinationLabel = !step
            ? ''
            : step.destination === 'hand'
              ? `${controller.name}'s hand`
              : `the bottom of ${controller.name}'s library`;
          return (
            <RevealDivideModal
              sourceName={sourceName}
              cards={pending.revealed.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              isYourChoice={isYourChoice}
              chooserName={chooserName}
              destinationLabel={destinationLabel}
              onChoose={(instanceId) => onAction({ type: 'CHOOSE_REVEALED_CARD', instanceId }, expectedChooserId ?? yourPlayerId)}
            />
          );
        })()}

      {/* Unlike pendingReveal, surveiled cards are private - only the
          controller (or the soloControl player, who sees everything) ever
          renders this modal at all. */}
      {state.pendingSurveil &&
        (state.pendingSurveil.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingSurveil;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          return (
            <SurveilModal
              sourceName={sourceName}
              cards={pending.cards.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onConfirm={(graveyardIds, keepOrder) => onAction({ type: 'RESOLVE_SURVEIL', graveyardIds, keepOrder }, pending.controllerId)}
            />
          );
        })()}

      {state.pendingExplore &&
        (state.pendingExplore.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingExplore;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This creature';
          const revealedDef = getCardDefinition(pending.revealedCard.defId);
          return (
            <div className="card-actions-overlay">
              <div className="zone-modal">
                <div className="card-actions-header">
                  <strong>{sourceName} explores</strong>
                </div>
                <p className="card-actions-text">Put {revealedDef.name} back on top of your library, or into your graveyard?</p>
                <div className="zone-modal-grid">
                  <Card definition={revealedDef} instance={pending.revealedCard} onClick={() => undefined} />
                </div>
                <button
                  className="opponent-view-exit-button"
                  onClick={() => onAction({ type: 'RESOLVE_EXPLORE', toGraveyard: false }, pending.controllerId)}
                >
                  Keep on top
                </button>
                <button
                  className="opponent-view-exit-button"
                  onClick={() => onAction({ type: 'RESOLVE_EXPLORE', toGraveyard: true }, pending.controllerId)}
                >
                  Put into graveyard
                </button>
              </div>
            </div>
          );
        })()}

      {state.pendingReturnFromGraveyard &&
        (() => {
          const pending = state.pendingReturnFromGraveyard;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.graveyard.filter((c) => {
            const d = getCardDefinition(c.defId);
            return d.type === 'creature' || d.type === 'artifact' || d.type === 'enchantment' || d.type === 'land';
          });
          return (
            <ReturnFromGraveyardModal
              sourceName={sourceName}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RETURN_FROM_GRAVEYARD', instanceId }, pending.controllerId)}
            />
          );
        })()}

      {state.pendingReanimate &&
        (() => {
          const pending = state.pendingReanimate;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.graveyard.filter((c) => matchesReanimateFilter(getCardDefinition(c.defId), pending.effect));
          const title = pending.effect.anyPermanentInsteadOfCreature || pending.effect.nonlegendaryPermanentInsteadOfCreature ? 'Return a permanent' : 'Return a creature';
          const description =
            pending.effect.anyPermanentInsteadOfCreature || pending.effect.nonlegendaryPermanentInsteadOfCreature
              ? 'Choose a permanent card from your graveyard to return to the battlefield.'
              : 'Choose a creature card from your graveyard to return to the battlefield.';
          return (
            <ReturnFromGraveyardModal
              sourceName={sourceName}
              title={title}
              description={description}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_REANIMATE', instanceId }, pending.controllerId)}
              onCancel={pending.effect.optional ? () => onAction({ type: 'RESOLVE_REANIMATE', instanceId: null }, pending.controllerId) : undefined}
            />
          );
        })()}

      {state.pendingReturnCreaturesFromGraveyard &&
        (() => {
          const pending = state.pendingReturnCreaturesFromGraveyard;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.graveyard.filter((c) => getCardDefinition(c.defId).type === 'creature');
          return (
            <ReturnFromGraveyardModal
              sourceName={sourceName}
              title={`Return a creature (${pending.remaining} left)`}
              description="Choose a creature card from your graveyard to return to your hand."
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD', instanceId }, pending.controllerId)}
              onCancel={() => onAction({ type: 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD', instanceId: null }, pending.controllerId)}
            />
          );
        })()}

      {state.pendingReturnCreatureFromGraveyardHandOrBattlefield &&
        (() => {
          const pending = state.pendingReturnCreatureFromGraveyardHandOrBattlefield;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.graveyard.filter((c) => getCardDefinition(c.defId).type === 'creature');
          return (
            <ReturnFromGraveyardModal
              sourceName={sourceName}
              title={pending.toBattlefield ? 'Return a creature to the battlefield' : 'Return a creature to your hand'}
              description={
                pending.toBattlefield
                  ? 'Choose a creature card from your graveyard to return to the battlefield.'
                  : 'Choose a creature card from your graveyard to return to your hand.'
              }
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD_HAND_OR_BATTLEFIELD', instanceId }, pending.controllerId)}
              onCancel={() => onAction({ type: 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD_HAND_OR_BATTLEFIELD', instanceId: null }, pending.controllerId)}
            />
          );
        })()}

      {state.pendingEspersToMagiciteChoice &&
        (() => {
          const pending = state.pendingEspersToMagiciteChoice;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const eligible = state.players
            .flatMap((p) => p.zones.exile)
            .filter((c) => pending.eligibleInstanceIds.includes(c.instanceId));
          return (
            <ReturnFromGraveyardModal
              sourceName={sourceName}
              title="Create a token copy?"
              description="Choose up to one creature card exiled this way to create a token copy of."
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_ESPERS_TO_MAGICITE_CHOICE', instanceId }, pending.controllerId)}
              onCancel={() => onAction({ type: 'RESOLVE_ESPERS_TO_MAGICITE_CHOICE', instanceId: null }, pending.controllerId)}
            />
          );
        })()}

      {/* Like pendingSurveil, this shows the controller's own hand - private
          information, so only the controller (or soloControl) ever renders it. */}
      {state.pendingDiscard &&
        (state.pendingDiscard.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingDiscard;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          return (
            <DiscardModal
              sourceName={sourceName}
              count={pending.count}
              cards={controller.zones.hand.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'DISCARD_CARD', instanceId }, pending.controllerId)}
            />
          );
        })()}

      {state.pendingFreeCastFromHand &&
        (state.pendingFreeCastFromHand.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingFreeCastFromHand;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const opponentOfController = state.players.find((p) => p.id !== pending.controllerId);
          const eligible = controller.zones.hand.filter((c) => {
            const d = getCardDefinition(c.defId);
            return d.type !== 'land' && manaValue(effectiveCastCost(d, controller, opponentOfController)) <= pending.maxManaValue;
          });
          return (
            <FreeCastModal
              sourceName={sourceName}
              maxManaValue={pending.maxManaValue}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_FREE_CAST_FROM_HAND', instanceId }, pending.controllerId)}
              onSkip={() => onAction({ type: 'RESOLVE_FREE_CAST_FROM_HAND', instanceId: null }, pending.controllerId)}
            />
          );
        })()}

      {/* A coin flip is public - both players see it, but only the
          controller (or soloControl) gets Heads/Tails buttons; everyone
          else sees a "waiting for..." message. Shows for pendingCoinFlip
          (still choosing) OR a freshly-detected lastCoinFlip (revealing the
          already-resolved result) - see showingCoinFlipResult above. */}
      {(state.pendingCoinFlip || (showingCoinFlipResult && state.lastCoinFlip)) &&
        (() => {
          const sourceInstanceId = state.pendingCoinFlip?.sourceInstanceId ?? state.lastCoinFlip!.sourceInstanceId;
          const controllerId = state.pendingCoinFlip?.controllerId ?? state.lastCoinFlip!.controllerId;
          const sourceFound = findCard(state, sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === controllerId)!;
          const canChoose = controllerId === yourPlayerId || !!soloControl;
          return (
            <CoinFlipModal
              sourceName={sourceName}
              controllerName={controller.name}
              canChoose={canChoose}
              phase={state.pendingCoinFlip ? 'choosing' : 'revealing'}
              result={state.pendingCoinFlip ? null : state.lastCoinFlip}
              onChoose={(side) => onAction({ type: 'CHOOSE_COIN_SIDE', side }, controllerId)}
              onDismiss={() => setShowingCoinFlipResult(false)}
            />
          );
        })()}

      {state.pendingLibrarySearch &&
        (state.pendingLibrarySearch.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingLibrarySearch;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.library.filter((c) => matchesLibrarySearchFilter(getCardDefinition(c.defId), pending.filter));
          return (
            <LibrarySearchModal
              sourceName={sourceName}
              filter={pending.filter}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_LIBRARY_SEARCH', instanceId }, pending.controllerId)}
              onFindNothing={() => onAction({ type: 'RESOLVE_LIBRARY_SEARCH', instanceId: null }, pending.controllerId)}
              mayChooseBattlefieldTapped={pending.mayChooseBattlefieldTapped}
              onChooseDestination={(instanceId, toBattlefieldTapped) => onAction({ type: 'RESOLVE_LIBRARY_SEARCH', instanceId, toBattlefieldTapped }, pending.controllerId)}
            />
          );
        })()}

      {/* "Appears on the opponent's screen" - the searching player already
          saw what they found (they just picked it from their own library),
          so this passing notification is specifically for whoever DIDN'T do
          the finding. soloControl sees it regardless (same person is
          playing both sides there anyway). */}
      {showingRevealResult &&
        state.lastReveal &&
        (state.lastReveal.ownerId !== yourPlayerId || soloControl) &&
        (() => {
          const reveal = state.lastReveal;
          const owner = state.players.find((p) => p.id === reveal.ownerId)!;
          const found = findCard(state, reveal.instanceId);
          const sourceFound = findCard(state, reveal.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'an ability';
          if (!found) return null;
          return (
            <RevealNotificationModal
              ownerName={owner.name}
              sourceName={sourceName}
              definition={getCardDefinition(found.card.defId)}
              instance={found.card}
              onDismiss={() => setShowingRevealResult(false)}
            />
          );
        })()}

      {/* Unlike pendingDiscard/pendingSurveil, a bounce target is a
          battlefield permanent - public information - so this shows for
          both players, no privacy gating needed. */}
      {state.pendingOptionalBounce &&
        (() => {
          const pending = state.pendingOptionalBounce;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.battlefield.filter((c) => c.instanceId !== pending.sourceInstanceId);
          return (
            <OptionalBounceModal
              sourceName={sourceName}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_OPTIONAL_BOUNCE', instanceId }, pending.controllerId)}
              onSkip={() => onAction({ type: 'RESOLVE_OPTIONAL_BOUNCE', instanceId: null }, pending.controllerId)}
            />
          );
        })()}

      {/* Mandatory version of the above (Zell Dincht's end step trigger) -
          no Skip button, and only ever set when at least one land exists to
          return (see engine/effects.ts: the returnControlledLandToHand branch). */}
      {state.pendingLandBounce &&
        (() => {
          const pending = state.pendingLandBounce;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'land');
          return (
            <OptionalBounceModal
              sourceName={sourceName}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_LAND_BOUNCE', instanceId }, pending.controllerId)}
              title="Return a land"
              prompt="Return a land you control to its owner's hand."
            />
          );
        })()}

      {state.pendingPutLandFromHand &&
        (() => {
          const pending = state.pendingPutLandFromHand;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.hand.filter((c) => getCardDefinition(c.defId).type === 'land');
          return (
            <OptionalBounceModal
              sourceName={sourceName}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_PUT_LAND_FROM_HAND', instanceId }, pending.controllerId)}
              onSkip={() => onAction({ type: 'RESOLVE_PUT_LAND_FROM_HAND', instanceId: null }, pending.controllerId)}
              title="Put a land onto the battlefield?"
              prompt="You may put a land card from your hand onto the battlefield."
            />
          );
        })()}

      {state.pendingPutCreatureAndOrLandFromHand &&
        (() => {
          const pending = state.pendingPutCreatureAndOrLandFromHand;
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.hand.filter((c) => getCardDefinition(c.defId).type === pending.stage);
          return (
            <OptionalBounceModal
              sourceName="Yuna’s Decision"
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_PUT_CREATURE_OR_LAND_FROM_HAND', instanceId }, pending.controllerId)}
              onSkip={() => onAction({ type: 'RESOLVE_PUT_CREATURE_OR_LAND_FROM_HAND', instanceId: null }, pending.controllerId)}
              title={`Put a ${pending.stage} onto the battlefield?`}
              prompt={`You may put a ${pending.stage} card from your hand onto the battlefield.`}
              emptyText={`No ${pending.stage} card in hand.`}
            />
          );
        })()}

      {state.pendingRevealLandTypeFromHand &&
        (() => {
          const pending = state.pendingRevealLandTypeFromHand;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This land';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.hand.filter((c) => pending.landNames.includes(getCardDefinition(c.defId).name));
          return (
            <OptionalBounceModal
              sourceName={sourceName}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_REVEAL_LAND_TYPE_FROM_HAND', instanceId }, pending.controllerId)}
              onSkip={() => onAction({ type: 'RESOLVE_REVEAL_LAND_TYPE_FROM_HAND', instanceId: null }, pending.controllerId)}
              title="Reveal a card to enter untapped?"
              prompt={`You may reveal a ${pending.landNames.join(' or ')} card from your hand. If you don't, ${sourceName} enters tapped.`}
              emptyText={`No ${pending.landNames.join(' or ')} card in hand - ${sourceName} enters tapped.`}
            />
          );
        })()}

      {state.pendingReturnInstantOrSorceryFromGraveyard &&
        (() => {
          const pending = state.pendingReturnInstantOrSorceryFromGraveyard;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.graveyard.filter((c) => ['instant', 'sorcery'].includes(getCardDefinition(c.defId).type));
          return (
            <OptionalBounceModal
              sourceName={sourceName}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_RETURN_INSTANT_OR_SORCERY_FROM_GRAVEYARD', instanceId }, pending.controllerId)}
              title="Return a card"
              prompt="Return an instant or sorcery card from your graveyard to your hand."
            />
          );
        })()}

      {state.pendingCastFromGraveyardAnyMana &&
        (() => {
          const pending = state.pendingCastFromGraveyardAnyMana;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const eligible = [...state.players[0].zones.graveyard, ...state.players[1].zones.graveyard].filter((c) =>
            ['instant', 'sorcery'].includes(getCardDefinition(c.defId).type)
          );
          return (
            <OptionalBounceModal
              sourceName={sourceName}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_CAST_FROM_GRAVEYARD_ANY_MANA', instanceId }, pending.controllerId)}
              onSkip={() => onAction({ type: 'RESOLVE_CAST_FROM_GRAVEYARD_ANY_MANA', instanceId: null }, pending.controllerId)}
              title="Cast from a graveyard?"
              prompt="You may cast target instant or sorcery card from a graveyard - mana of any type can be spent to cast it."
            />
          );
        })()}

      {state.pendingMillThenPutLandIntoHand &&
        (() => {
          const pending = state.pendingMillThenPutLandIntoHand;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const eligible = controller.zones.graveyard.filter(
            (c) => pending.milledInstanceIds.includes(c.instanceId) && getCardDefinition(c.defId).type === 'land'
          );
          return (
            <OptionalBounceModal
              sourceName={sourceName}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_MILL_THEN_PUT_LAND_INTO_HAND', instanceId }, pending.controllerId)}
              onSkip={() => onAction({ type: 'RESOLVE_MILL_THEN_PUT_LAND_INTO_HAND', instanceId: null }, pending.controllerId)}
              title="Put a land into hand?"
              prompt="You may put a land card from among the milled cards into your hand."
            />
          );
        })()}

      {state.pendingLibraryOrGraveyardSearch &&
        (() => {
          const pending = state.pendingLibraryOrGraveyardSearch;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          const controller = state.players.find((p) => p.id === pending.controllerId)!;
          const matches = (c: CardInstance) => {
            const d = getCardDefinition(c.defId);
            return d.type === 'artifact' && manaValue(parseCostLabel(d.costLabel)) <= pending.maxManaValue;
          };
          const eligible = [...controller.zones.library.filter(matches), ...controller.zones.graveyard.filter(matches)];
          return (
            <OptionalBounceModal
              sourceName={sourceName}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_LIBRARY_OR_GRAVEYARD_SEARCH', instanceId }, pending.controllerId)}
              title="Search your library and graveyard"
              prompt={`Search your library and/or graveyard for an artifact card with mana value ${pending.maxManaValue} or less.`}
            />
          );
        })()}

      {/* Like pendingSurveil/pendingDiscard, the revealed cards come from the
          library - private information, so only the controller (or
          soloControl) ever renders this modal at all. */}
      {state.pendingRevealFiltered &&
        (state.pendingRevealFiltered.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingRevealFiltered;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          return (
            <RevealFilteredModal
              sourceName={sourceName}
              filterType={pending.filterType}
              cards={pending.revealed.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_REVEAL_FILTERED', instanceId }, pending.controllerId)}
              onSkip={() => onAction({ type: 'RESOLVE_REVEAL_FILTERED', instanceId: null }, pending.controllerId)}
              takenDestination={pending.takenDestination}
            />
          );
        })()}

      {/* Like pendingRevealFiltered, the looked-at cards come from the
          library - private information, so only the controller (or
          soloControl) ever renders this modal at all. */}
      {state.pendingHideaway &&
        (state.pendingHideaway.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingHideaway;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This land';
          return (
            <HideawayModal
              sourceName={sourceName}
              count={pending.cards.length}
              cards={pending.cards.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              onChoose={(instanceId) => onAction({ type: 'RESOLVE_HIDEAWAY', instanceId }, pending.controllerId)}
            />
          );
        })()}

      {pendingCastConfirm &&
        (() => {
          const def = getCardDefinition(pendingCastConfirm.defId);
          return (
            <CastConfirmModal
              definition={def}
              onConfirm={() => {
                handleCast(pendingCastConfirm);
                setPendingCastConfirm(null);
              }}
              onCancel={() => setPendingCastConfirm(null)}
            />
          );
        })()}

      {pendingModalCast &&
        (() => {
          const def = getCardDefinition(pendingModalCast.defId);
          return (
            <ModalSpellModal
              definition={def}
              onConfirm={(chosenModeIndices) => {
                if (def.escalateCost && chosenModeIndices.length > 1) {
                  setPendingEscalateCost({
                    instanceId: pendingModalCast.instanceId,
                    ownerId: pendingModalCast.ownerId,
                    chosenModeIndices,
                    count: chosenModeIndices.length - 1,
                    selected: [],
                  });
                } else {
                  onAction({ type: 'CAST_CARD', instanceId: pendingModalCast.instanceId, chosenModeIndices });
                }
                setPendingModalCast(null);
                setOpenPanelId(null);
              }}
              onCancel={() => setPendingModalCast(null)}
            />
          );
        })()}

      {pendingTieredCast &&
        (() => {
          const def = getCardDefinition(pendingTieredCast.defId);
          return (
            <TieredModeModal
              definition={def}
              onConfirm={(chosenTierIndex) => {
                onAction({ type: 'CAST_CARD', instanceId: pendingTieredCast.instanceId, chosenTierIndex });
                setPendingTieredCast(null);
                setOpenPanelId(null);
              }}
              onCancel={() => setPendingTieredCast(null)}
            />
          );
        })()}

      {pendingKickerCast &&
        (() => {
          const def = getCardDefinition(pendingKickerCast.defId);
          const found = findCard(state, pendingKickerCast.instanceId);
          const caster = found ? found.player : null;
          const eligible = (caster?.zones.battlefield ?? []).filter((c) => {
            const cDef = getCardDefinition(c.defId);
            return def.kicker!.cost === 'returnLandToHand' ? cDef.type === 'land' : cDef.type === 'creature' || cDef.type === 'artifact';
          });
          const costLabel = def.kicker!.cost === 'returnLandToHand' ? 'return a land you control to its owner’s hand' : 'sacrifice a creature or artifact you control';
          return (
            <OptionalBounceModal
              sourceName={def.name}
              cards={eligible.map((c) => ({ definition: getCardDefinition(c.defId), instance: c }))}
              title="Pay Kicker?"
              prompt={`Kicker — ${costLabel}.`}
              emptyText="Nothing eligible to pay Kicker with."
              onChoose={(instanceId) => {
                onAction({ type: 'CAST_CARD', instanceId: pendingKickerCast.instanceId, kickerPaymentInstanceId: instanceId });
                setPendingKickerCast(null);
                setOpenPanelId(null);
              }}
              onSkip={() => {
                onAction({ type: 'CAST_CARD', instanceId: pendingKickerCast.instanceId });
                setPendingKickerCast(null);
                setOpenPanelId(null);
              }}
            />
          );
        })()}

      {state.pendingChooseOneMode &&
        (() => {
          const pending = state.pendingChooseOneMode;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'Choose one';
          const controller = state.players.find((p) => p.id === pending.controllerId);
          const allowBoth = !!pending.allowBothIfCommander && !!controller?.commanderDefId;
          return (
            <ChooseOneModeModal
              sourceName={sourceName}
              modes={pending.modes}
              allowBoth={allowBoth}
              onChoose={(modeIndex, alsoModeIndex) => onAction({ type: 'RESOLVE_CHOOSE_ONE_MODE', modeIndex, alsoModeIndex }, pending.controllerId)}
            />
          );
        })()}

      {/* "As it enters, choose a color" (Crossroads Village) - one of the
          five real colors only (see engine/actions.ts: chooseManaColor's own
          rejection of 'C'), so there are only ever 5 buttons here, never a
          6th colorless one. Blocks the land's own Tap button until resolved
          (see GameBoard's tapDisabledReason). */}
      {state.pendingManaColorChoice &&
        (state.pendingManaColorChoice.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingManaColorChoice;
          const sourceFound = findCard(state, pending.instanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This land';
          const colors: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
          return (
            <div className="card-drawer-overlay">
              <div className="card-actions-panel">
                <div className="card-actions-header">
                  <strong>{sourceName} - choose a color</strong>
                </div>
                <div className="card-actions-bottom-row">
                  {colors.map((color) => (
                    <button
                      key={color}
                      className={`mana-choice-button mana-${color}`}
                      onClick={() => onAction({ type: 'CHOOSE_MANA_COLOR', color }, pending.controllerId)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

      {state.pendingAddManaOfChosenColor &&
        (state.pendingAddManaOfChosenColor.controllerId === yourPlayerId || soloControl) &&
        (() => {
          const pending = state.pendingAddManaOfChosenColor;
          const colors: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
          return (
            <div className="card-drawer-overlay">
              <div className="card-actions-panel">
                <div className="card-actions-header">
                  <strong>Choose a color - add one mana</strong>
                </div>
                <div className="card-actions-bottom-row">
                  {colors.map((color) => (
                    <button
                      key={color}
                      className={`mana-choice-button mana-${color}`}
                      onClick={() => onAction({ type: 'RESOLVE_ADD_MANA_OF_CHOSEN_COLOR', color }, pending.controllerId)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

      {state.pendingPlayerTarget &&
        (() => {
          const pending = state.pendingPlayerTarget;
          const sourceFound = findCard(state, pending.sourceInstanceId);
          const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This ability';
          return (
            <div className="card-drawer-overlay">
              <div className="card-actions-panel">
                <div className="card-actions-header">
                  <strong>{sourceName} - choose a player</strong>
                </div>
                <div className="card-actions-section">
                  <span className="card-actions-hint">
                    {pending.effect.type === 'drawCardsFromTargetPlayer'
                      ? `Target player draws ${pending.effect.count} card(s).`
                      : pending.effect.type === 'mayPutExactNamedCardFromLibraryToHandForTargetPlayer'
                      ? `Target player may put ${pending.effect.name} into their hand from their library, then shuffle.`
                      : pending.effect.type === 'graveyardToBottomOfLibraryForTargetPlayer'
                      ? 'Choose up to one target player to put all the cards from their graveyard on the bottom of their library in a random order - or Skip.'
                      : pending.effect.type === 'gainLifeForTargetPlayer'
                      ? `Target player gains ${pending.effect.amount} life.`
                      : pending.effect.type === 'loseLifeForTargetPlayer'
                      ? `Target player loses ${pending.effect.amount} life.`
                      : pending.effect.type === 'searchLibraryForAnyCardToTopForTargetPlayer'
                      ? 'Target player searches their library for a card, then shuffles and puts that card on top.'
                      : `Put a ${pending.effect.counterLabel} counter on each creature target player controls.`}
                  </span>
                </div>
                <div className="card-actions-spacer" />
                <div className="card-actions-bottom-row">
                  {state.players.map((p) => (
                    <button
                      key={p.id}
                      className="card-action-button card-action-button-play"
                      onClick={() => onAction({ type: 'CHOOSE_PLAYER_TARGET', targetPlayerId: p.id }, pending.controllerId)}
                    >
                      {p.id === pending.controllerId ? `${p.name} (yourself)` : p.name}
                    </button>
                  ))}
                  {pending.effect.type === 'graveyardToBottomOfLibraryForTargetPlayer' && (
                    <button className="opponent-view-exit-button" onClick={() => onAction({ type: 'CHOOSE_PLAYER_TARGET', targetPlayerId: null }, pending.controllerId)}>
                      Skip
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {actionError && <div className="action-error-banner action-error-bottom">{actionError}</div>}
    </div>
  );
}