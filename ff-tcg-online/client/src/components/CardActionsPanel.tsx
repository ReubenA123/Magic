import React, { useState } from 'react';
import { CardAbility, CardDefinition, CardInstance, ManaColor, ManaPool, ZoneName } from '../types';
import { parseCostLabel, canPay } from '../engine/mana';
import { EquipmentContribution } from '../engine/combat';
import { getCardDefinition } from '../data/cards';

/** What a mana-producing permanent's plain tap ability actually adds -
 * shown as a caption under its Tap button so it isn't just a bare, ambiguous
 * "Tap" when the SAME card also has one or more named tap-cost abilities
 * (e.g. Ring of the Lucii, Clive's Hideaway) - each gets its own clearly
 * labeled button instead of several indistinguishable "Tap" buttons. Only
 * meaningful when there's no real color choice to make (see
 * CardActionsPanel's needsManaChoice) - a dual/any-color source shows its
 * options via the mana-choice pips instead. */
function describeProducesMana(def: CardDefinition): string | null {
  if (!def.producesMana) return null;
  const amount = def.producesManaAmount ?? 1;
  const colorPart = def.producesMana === 'any' ? 'any color' : Array.isArray(def.producesMana) ? def.producesMana.join(' or ') : def.producesMana;
  return `Add ${amount > 1 ? `${amount} ` : ''}${colorPart}`;
}

/** A named ability's cost, formatted for its OWN button - "Tap" is pulled
 * out front whenever the cost includes it, so a card with both a plain
 * mana-tap and a paid tap-cost ability reads as two clearly distinct "Tap"
 * buttons (one bare, one "Tap 2UU" or similar) rather than two identical-
 * looking "Tap" buttons. Falls back to the ability's own `label` when its
 * cost has no tap at all (e.g. The Gold Saucer's "Sacrifice two artifacts:
 * Draw a card"). */
function abilityButtonLabel(ability: CardAbility): string {
  if (!ability.cost.tap) return ability.label;
  const rest: string[] = [];
  if (ability.cost.manaLabel) rest.push(ability.cost.manaLabel);
  if (ability.cost.sacrificeSelf) rest.push('Sacrifice this');
  if (ability.cost.sacrificeAnother) {
    const count = ability.cost.sacrificeAnotherCount ?? 1;
    const noun = ability.cost.sacrificeAnother === 'artifactOrCreature' ? 'creature(s)/artifact(s)' : `${ability.cost.sacrificeAnother}(s)`;
    rest.push(`Sacrifice ${count > 1 ? count : 'another'} ${noun}`);
  }
  if (ability.cost.payLife) rest.push(`Pay ${ability.cost.payLife} life`);
  if (ability.cost.discardCards) rest.push(`Discard ${ability.cost.discardCards}`);
  if (ability.cost.exileFromGraveyard) rest.push(`Exile ${ability.cost.exileFromGraveyard} from graveyard`);
  if (ability.cost.exileSelf) rest.push('Exile this');
  return rest.length > 0 ? `Tap ${rest.join(', ')}` : 'Tap';
}

interface CardActionsPanelProps {
  definition: CardDefinition;
  instance: CardInstance;
  currentZone: ZoneName;
  ownerManaPool: ManaPool;
  ownerCommanderDefId?: string;
  mutualActive: boolean;
  isMyTurn: boolean;
  /** True only while it's this card owner's own end step - gates any
   * ability with CardAbility.onlyDuringOwnEndStep (e.g. Ultimecia's
   * Transform). Ignored (never blocks) under Mutual Adjustment. */
  isMyEndStep: boolean;
  /** True only while it's this card owner's own first main phase - gates any
   * ability with CardAbility.onlyDuringOwnFirstMainPhase (e.g. Vanille's
   * meld). Ignored (never blocks) under Mutual Adjustment. */
  isMyFirstMainPhase: boolean;
  /** True only while it's this card owner's own upkeep - gates any ability
   * with CardAbility.onlyDuringOwnUpkeep (e.g. Emet-Selch's Transform).
   * Ignored (never blocks) under Mutual Adjustment. */
  isMyUpkeep: boolean;
  /** True during this card owner's own turn, EITHER main phase - gates any
   * ability with CardAbility.onlyDuringOwnMainPhase ("Activate only as a
   * sorcery", e.g. Clive, Ifrit's Dominant). Ignored under Mutual Adjustment. */
  isMyMainPhase: boolean;
  /** This card's owner's current graveyard size - gates any ability with a
   * CardAbility.cost.exileFromGraveyard or .requiresGraveyardSize requirement. */
  ownerGraveyardCount: number;
  /** This card's owner's current count of controlled legendary creatures -
   * gates any ability with CardAbility.requiresControlledLegendaryCreatureCount
   * (Clive's Hideaway's release ability). */
  ownerLegendaryCreatureCount: number;
  /** How much this card's own dynamic cost-reduction fields
   * (costReductionPerGraveyardPermanent - Diamond Weapon;
   * costReductionPerControlledSubtype/costReductionPerControlledType) are
   * worth right now, BEFORE capping at the printed generic cost - see
   * engine/mana.ts: dynamicCostReduction, computed by GameBoard.tsx from the
   * owner's current board/graveyard. 0 for a card with none of those fields. */
  costReduction: number;
  /** defIds of every creature this card's owner currently controls - gates
   * any ability with a CardAbility.meldsWith requirement (the named partner
   * must be present). */
  ownerBattlefieldDefIds: string[];
  alreadyPlayedLand: boolean;
  attachedToName: string | null;
  /** RevealTopThenLoseLifeByManaValueEffect's (Dark Confidant) running
   * history - every card this permanent has revealed while continuously on
   * the battlefield, in reveal order. Visible to both players (that's the
   * whole point of a card like this) - undefined/omitted whenever this
   * panel isn't currently open on a battlefield permanent with a nonempty
   * CardInstance.revealedCardIds. `stillInHand` false greys the entry out
   * (played, discarded, ...) rather than removing it. */
  revealedCards?: { instanceId: string; defId: string; stillInHand: boolean }[];
  /** What each Equipment/Aura currently attached to THIS permanent is
   * individually contributing (stat bonus, granted keyword, granted
   * subtype) - see engine/combat.ts: equipmentContributions, computed by
   * GameBoard.tsx. Empty/undefined whenever nothing is attached or this
   * isn't a battlefield permanent. Drives both the effective-type line
   * (appending any granted subtype, e.g. "Knight") and the "Modifiers"
   * breakdown below the card text. */
  equipmentContributions?: EquipmentContribution[];
  /** Someone else's card, viewed outside Mutual Adjustment - the image and
   * text still show, but every action button (tap, cast, abilities, attach,
   * cycle, flashback) is hidden rather than offering something that isn't yours to do. */
  readOnly?: boolean;
  manaOptions?: ManaColor[];
  /** Why the Tap/Untap button should be disabled right now (e.g. "this land
   * entered tapped", "summoning sickness"), or null/undefined if pressing it
   * is currently legal - see GameBoard.tsx: tapDisabledReason. */
  tapDisabledReason?: string | null;
  onToggleTap: () => void;
  onChooseTapColor: (color: ManaColor) => void;
  onCast: () => void;
  onActivateAbility: (abilityId: string) => void;
  onMove: (toZone: ZoneName) => void;
  onAdjustCounter: (label: string, delta: number) => void;
  onStartAttach: () => void;
  onDetach: () => void;
  onStartCrew: () => void;
  onCycle: () => void;
  onFlashback: () => void;
  onClose: () => void;
}

const ZONE_LABELS: Record<ZoneName, string> = {
  library: 'Library (shuffles in)',
  hand: 'Hand',
  battlefield: 'Battlefield',
  graveyard: 'Graveyard',
  exile: 'Exile',
  commander: 'Commander zone',
};

const ALL_ZONES: ZoneName[] = ['hand', 'battlefield', 'graveyard', 'exile', 'library', 'commander'];

export default function CardActionsPanel({
  definition,
  instance,
  currentZone,
  ownerManaPool,
  ownerCommanderDefId,
  mutualActive,
  isMyTurn,
  isMyEndStep,
  isMyFirstMainPhase,
  isMyUpkeep,
  isMyMainPhase,
  ownerGraveyardCount,
  ownerLegendaryCreatureCount,
  costReduction,
  ownerBattlefieldDefIds,
  alreadyPlayedLand,
  attachedToName,
  revealedCards,
  equipmentContributions,
  readOnly,
  manaOptions,
  tapDisabledReason,
  onToggleTap,
  onChooseTapColor,
  onCast,
  onActivateAbility,
  onMove,
  onAdjustCounter,
  onStartAttach,
  onDetach,
  onStartCrew,
  onCycle,
  onFlashback,
  onClose,
}: CardActionsPanelProps) {
  const [showManaChoice, setShowManaChoice] = useState(false);

  const commanderTax = currentZone === 'commander' ? instance.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0 : 0;
  const printedCost = parseCostLabel(definition.costLabel);
  // Diamond Weapon (costReductionPerGraveyardPermanent), Travel the
  // Overworld (costReductionPerControlledSubtype), Valkyrie Aerial Unit
  // (costReductionPerControlledType) - see engine/mana.ts:
  // dynamicCostReduction. Capped at the printed generic cost, same as
  // engine/actions.ts: castCard actually applying it.
  const cappedCostReduction = Math.min(printedCost.generic, costReduction);
  const parsedCost = cappedCostReduction > 0 ? { ...printedCost, generic: printedCost.generic - cappedCostReduction } : printedCost;
  const isLand = definition.type === 'land';
  const canPlay = mutualActive || (isLand ? isMyTurn && !alreadyPlayedLand : canPay(ownerManaPool, parsedCost, commanderTax));
  const canPlayHere = currentZone === 'hand' || (currentZone === 'commander' && !isLand);
  const canCycleHere = currentZone === 'hand' && !!definition.cycling;
  const canCycle = canCycleHere && (mutualActive || canPay(ownerManaPool, parseCostLabel(definition.cycling!.cost), 0));
  const canFlashbackHere = currentZone === 'graveyard' && !!definition.flashback;
  const canFlashback = canFlashbackHere && (mutualActive || canPay(ownerManaPool, parseCostLabel(definition.flashback!.cost), 0));
  const isActualCommander = ownerCommanderDefId === definition.id;
  const isOnBattlefield = currentZone === 'battlefield';
  const needsManaChoice = !instance.tapped && !!manaOptions && manaOptions.length > 0;

  const availableZones = ALL_ZONES.filter((z) => z !== currentZone)
    .filter((z) => z !== 'commander' || isActualCommander)
    .filter((z) => z !== 'battlefield' || mutualActive);

  function handleTapClick() {
    if (needsManaChoice) {
      setShowManaChoice(true);
      return;
    }
    onToggleTap();
  }

  return (
    <div className="card-drawer-overlay" onClick={onClose}>
      <div className="card-preview-panel" onClick={(e) => e.stopPropagation()}>
        <img src={definition.imagePath} alt={definition.name} className="card-preview-image" />
      </div>

      <div className="card-actions-panel" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>{definition.name}</strong>
          <button className="close-button" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>

        {(definition.subtype || (equipmentContributions && equipmentContributions.some((c) => c.subtype))) && (
          <p className="card-actions-type-line">
            {definition.type}
            {definition.subtype ? ` — ${definition.subtype}` : ''}
            {equipmentContributions
              ?.filter((c) => c.subtype)
              .map((c) => (
                <span key={c.sourceInstanceId} className="card-actions-granted-subtype" title={`Granted by ${c.sourceName}`}>
                  {', '}
                  {c.subtype}
                </span>
              ))}
          </p>
        )}

        <p className="card-actions-text">{definition.text}</p>

        {equipmentContributions && equipmentContributions.length > 0 && (
          <div className="card-actions-section">
            <div className="card-actions-label">Modifiers</div>
            <ul className="equipment-contributions-list">
              {equipmentContributions.map((c) => (
                <li key={c.sourceInstanceId} className="modifier-entry">
                  <strong>{c.sourceName}:</strong>
                  {(c.power !== 0 || c.toughness !== 0) && (
                    <div className="modifier-entry-line">
                      {c.power >= 0 ? '+' : ''}
                      {c.power}/{c.toughness >= 0 ? '+' : ''}
                      {c.toughness}
                    </div>
                  )}
                  {c.keywords.length > 0 && <div className="modifier-entry-line">{c.keywords.join(', ')}</div>}
                  {c.subtype && (
                    <div className="modifier-entry-line">
                      Additional type: {c.subtype}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(instance.temporaryGrantedSubtype || instance.temporaryBuff || (instance.temporaryKeywords && instance.temporaryKeywords.length > 0)) && (
          <div className="card-actions-section">
            <div className="card-actions-label">Until end of turn</div>
            <ul className="equipment-contributions-list">
              <li className="modifier-entry">
                {instance.temporaryGrantedSubtype && <div className="modifier-entry-line">Additional type: {instance.temporaryGrantedSubtype}</div>}
                {instance.temporaryBuff && (instance.temporaryBuff.power !== 0 || instance.temporaryBuff.toughness !== 0) && (
                  <div className="modifier-entry-line">
                    {instance.temporaryBuff.power >= 0 ? '+' : ''}
                    {instance.temporaryBuff.power}/{instance.temporaryBuff.toughness >= 0 ? '+' : ''}
                    {instance.temporaryBuff.toughness} until end of turn
                  </div>
                )}
                {instance.temporaryKeywords && instance.temporaryKeywords.length > 0 && (
                  <div className="modifier-entry-line">{instance.temporaryKeywords.join(', ')} until end of turn</div>
                )}
              </li>
            </ul>
          </div>
        )}

        {revealedCards && revealedCards.length > 0 && (
          <div className="card-actions-section">
            <div className="card-actions-label">
              Revealed by {definition.name} ({revealedCards.length} card{revealedCards.length === 1 ? '' : 's'})
            </div>
            <ul className="revealed-cards-list">
              {revealedCards.map((rc) => (
                <li key={rc.instanceId} className={rc.stillInHand ? '' : 'revealed-card-gone'}>
                  {getCardDefinition(rc.defId).name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {mutualActive && <p className="mutual-active-note">Mutual Adjustment is active - normal cost/timing rules are suspended.</p>}

        {!readOnly && definition.attachesTo && isOnBattlefield && (
          <div className="card-actions-section">
            <div className="card-actions-label">Attachment</div>
            {attachedToName ? (
              <>
                <p className="card-actions-hint">Attached to: {attachedToName}</p>
                <button className="card-action-button secondary" onClick={onDetach}>
                  Detach
                </button>
              </>
            ) : (
              <button className="card-action-button secondary" onClick={onStartAttach}>
                {definition.equipCost ? `Equip (${definition.equipCost})` : 'Attach to\u2026'}
              </button>
            )}
          </div>
        )}

        {!readOnly && definition.crew !== undefined && isOnBattlefield && !instance.crewedUntilEndOfTurn && (
          <div className="card-actions-section">
            <div className="card-actions-label">Vehicle</div>
            <button className="card-action-button secondary" onClick={onStartCrew}>
              {`Crew (${definition.crew})`}
            </button>
          </div>
        )}

        {/* The plain mana-tap ability comes first, matching where "T: Add
            [mana]" sits relative to any paid tap ability in the card's own
            printed text (e.g. Clive's Hideaway, Ring of the Lucii) - both
            read top to bottom the same way the text does, instead of this
            one showing up last just because it isn't part of the `abilities`
            array. */}
        {!readOnly && isOnBattlefield && (
          <div className="card-actions-bottom-row">
            {showManaChoice ? (
              <div className="mana-choice-inline">
                <div className="mana-choice-inline-label">Choose which mana to add</div>
                <div className="mana-choice-buttons">
                  {manaOptions!.map((color) => (
                    <button key={color} className={`mana-choice-button mana-${color}`} onClick={() => onChooseTapColor(color)}>
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card-action-tap-wrapper">
                <button
                  className="card-action-button card-action-button-play"
                  onClick={handleTapClick}
                  disabled={!!tapDisabledReason}
                  title={tapDisabledReason ?? ''}
                >
                  {instance.tapped ? 'Untap' : 'Tap'}
                </button>
                {/* Distinguishes this plain mana tap from any OTHER named
                    tap-cost ability the same card has (Ring of the Lucii,
                    Clive's Hideaway, ...) - those show their own effect text
                    the same way, right under their own button (see the
                    Abilities section below). */}
                {!instance.tapped && !needsManaChoice && describeProducesMana(definition) && (
                  <p className="card-ability-effect-text">{describeProducesMana(definition)}</p>
                )}
                {tapDisabledReason && <div className="card-action-disabled-reason">({tapDisabledReason})</div>}
              </div>
            )}
          </div>
        )}

        {!readOnly && definition.abilities && definition.abilities.length > 0 && (
          <div className="card-actions-section">
            <div className="card-actions-label">Abilities</div>
            {definition.abilities.map((ability) => {
              const manaCost = ability.cost.manaLabel ? parseCostLabel(ability.cost.manaLabel) : null;
              const affordable = mutualActive || !manaCost || canPay(ownerManaPool, manaCost, 0);
              const tapBlocked = !!ability.cost.tap && instance.tapped;
              const graveyardBlocked = !!ability.cost.exileFromGraveyard && ownerGraveyardCount < ability.cost.exileFromGraveyard;
              const graveyardSizeBlocked = !!ability.requiresGraveyardSize && ownerGraveyardCount < ability.requiresGraveyardSize;
              const endStepBlocked = !!ability.onlyDuringOwnEndStep && !mutualActive && !isMyEndStep;
              const mainPhaseBlocked = !!ability.onlyDuringOwnFirstMainPhase && !mutualActive && !isMyFirstMainPhase;
              const upkeepBlocked = !!ability.onlyDuringOwnUpkeep && !mutualActive && !isMyUpkeep;
              const sorceryBlocked = !!ability.onlyDuringOwnMainPhase && !mutualActive && !isMyMainPhase;
              const meldPartnerMissing = !!ability.meldsWith && !ownerBattlefieldDefIds.includes(ability.meldsWith.partnerDefId);
              const wrongZoneForGraveyardAbility = !!ability.returnFromGraveyardTransformed && currentZone !== 'graveyard';
              const legendaryCountMissing = !!ability.requiresControlledLegendaryCreatureCount && ownerLegendaryCreatureCount < ability.requiresControlledLegendaryCreatureCount;
              const nothingHiddenAway = !!ability.playHideawayCard && !instance.hideawayExiledCardId;
              const disabled =
                !affordable ||
                tapBlocked ||
                graveyardBlocked ||
                graveyardSizeBlocked ||
                endStepBlocked ||
                mainPhaseBlocked ||
                upkeepBlocked ||
                sorceryBlocked ||
                meldPartnerMissing ||
                wrongZoneForGraveyardAbility ||
                legendaryCountMissing ||
                nothingHiddenAway;
              const blockedReason = endStepBlocked
                ? 'Only during your own end step'
                : mainPhaseBlocked
                  ? 'Only during your own first main phase'
                  : upkeepBlocked
                    ? 'Only during your own upkeep'
                    : sorceryBlocked
                      ? 'Only as a sorcery (your own turn, either main phase)'
                      : meldPartnerMissing
                      ? `Requires owning and controlling ${ability.meldsWith ? getCardDefinition(ability.meldsWith.partnerDefId).name : ''}`
                      : graveyardSizeBlocked
                        ? `Needs at least ${ability.requiresGraveyardSize} cards in your graveyard`
                        : graveyardBlocked
                          ? `Needs ${ability.cost.exileFromGraveyard} cards in your graveyard`
                          : wrongZoneForGraveyardAbility
                            ? 'Only activatable from the graveyard'
                            : legendaryCountMissing
                              ? `Requires controlling at least ${ability.requiresControlledLegendaryCreatureCount} legendary creatures`
                              : nothingHiddenAway
                                ? 'Nothing hidden away to play'
                                : '';
              return (
                <div key={ability.id} className="card-ability-row">
                  <button className="card-action-button secondary" disabled={disabled} onClick={() => onActivateAbility(ability.id)} title={blockedReason || ability.effectText}>
                    {abilityButtonLabel(ability)}
                  </button>
                  {/* Shown for every tap-cost ability, not just when a card
                      has more than one - a lone "Tap (2)" button still reads
                      more clearly with its effect spelled out underneath
                      than relying on a hover tooltip alone. */}
                  {ability.cost.tap && <p className="card-ability-effect-text">{ability.effectText}</p>}
                </div>
              );
            })}
          </div>
        )}

        {mutualActive && (
          <div className="card-actions-section">
            <div className="card-actions-label">Move to (Mutual Adjustment)</div>
            <div className="card-actions-zone-row">
              {availableZones.map((zone) => (
                <button key={zone} className="card-action-button secondary" onClick={() => onMove(zone)}>
                  {ZONE_LABELS[zone]}
                </button>
              ))}
            </div>
          </div>
        )}

        {mutualActive && (
          <div className="card-actions-section">
            <div className="card-actions-label">Counters (Mutual Adjustment)</div>
            {instance.counters.length === 0 && <p className="card-actions-hint">No counters yet.</p>}
            {instance.counters.map((c) => (
              <div key={c.label} className="counter-row">
                <span>
                  {c.label}: {c.amount}
                </span>
                <button className="counter-step" onClick={() => onAdjustCounter(c.label, -1)}>
                  {'\u2013'}
                </button>
                <button className="counter-step" onClick={() => onAdjustCounter(c.label, 1)}>
                  +
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="card-actions-spacer" />

        {/* No manual "Flip / Transform" button anywhere in this panel on
            purpose - every transformsInto card in this set transforms either
            via a paid CardAbility (transformSelf/exileAndReturnTransformed/
            returnFromGraveyardTransformed, its own button under Abilities
            above) or an automatic trigger (Saga chapter, an onOwn* hook, a
            "may transform" reactive prompt, ...). A free unconditional flip
            would let a player bypass whatever condition (paid or automatic)
            actually gates that specific card's transform - see FLIP_CARD's
            history for a card that was doing exactly that. */}
        {!readOnly && canPlayHere && (
          <button className="card-action-button card-action-button-play" disabled={!canPlay} onClick={onCast} title={canPlay ? '' : isLand ? 'Already played a land, or not your turn' : 'Not enough mana'}>
            {isLand
              ? `Play ${definition.name}`
              : `Cast (${definition.costLabel}${cappedCostReduction > 0 ? ` −${cappedCostReduction}` : ''}${commanderTax > 0 ? ` +${commanderTax} tax` : ''})`}
          </button>
        )}

        {!readOnly && canCycleHere && (
          <button className="card-action-button secondary" disabled={!canCycle} onClick={onCycle} title={canCycle ? '' : 'Not enough mana'}>
            {`Cycle (${definition.cycling!.cost})`}
          </button>
        )}

        {!readOnly && canFlashbackHere && (
          <button className="card-action-button card-action-button-play" disabled={!canFlashback} onClick={onFlashback} title={canFlashback ? '' : 'Not enough mana'}>
            {`Flashback (${definition.flashback!.cost})`}
          </button>
        )}
      </div>
    </div>
  );
}