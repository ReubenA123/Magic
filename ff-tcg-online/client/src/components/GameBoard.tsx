import React, { useEffect, useRef, useState } from 'react';
import { CardInstance, GameAction, GameState, ManaColor, PlayerState, ZoneName } from '../types';
import { getCardDefinition } from '../data/cards';
import { parseCostLabel, canPay } from '../engine/mana';
import { hasKeyword } from '../engine/keywords';
import Card from './Card';
import PhaseBar from './PhaseBar';
import CardActionsPanel from './CardActionsPanel';
import ZoneModal from './ZoneModal';
import EventLog from './EventLog';
import MutualAdjustmentControls from './MutualAdjustmentControls';

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

function splitBattlefield(cards: CardInstance[]) {
  const creatures: CardInstance[] = [];
  const others: CardInstance[] = [];
  const lands: CardInstance[] = [];
  for (const c of cards) {
    const def = getCardDefinition(c.defId);
    if (def.type === 'creature') creatures.push(c);
    else if (def.type === 'land') lands.push(c);
    else others.push(c);
  }
  return { creatures, others, lands };
}

function displayInstance(instance: CardInstance): CardInstance {
  if (!instance.counters.some((c) => c.label === 'Commander Tax')) return instance;
  return { ...instance, counters: instance.counters.filter((c) => c.label !== 'Commander Tax') };
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
 * Left = untap (both its +/- adjust how many to untap), right = tap (both
 * its +/- adjust how many to tap) - set the amount, then press Untap/Tap to
 * act on exactly that many at once. The middle number is the live count of
 * cards still available to tap right now.
 */
function StackTapControls({
  tappedCount,
  untappedCount,
  onTapN,
  onUntapN,
}: {
  tappedCount: number;
  untappedCount: number;
  onTapN: (n: number) => void;
  onUntapN: (n: number) => void;
}) {
  const [untapAmount, setUntapAmount] = useState(1);
  const [tapAmount, setTapAmount] = useState(1);

  const clampedUntap = Math.min(Math.max(untapAmount, 1), Math.max(tappedCount, 1));
  const clampedTap = Math.min(Math.max(tapAmount, 1), Math.max(untappedCount, 1));

  return (
    <div className="stack-tap-controls">
      <div className="stack-tap-row">
        <div className="stack-tap-group">
          <button className="stack-tap-step" disabled={tappedCount === 0} onClick={() => setUntapAmount((n) => Math.max(1, n - 1))} title="Fewer to untap">
            −
          </button>
          <input
            className="stack-tap-input"
            type="number"
            min={1}
            max={Math.max(tappedCount, 1)}
            value={clampedUntap}
            disabled={tappedCount === 0}
            onChange={(e) => setUntapAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
          <button className="stack-tap-step" disabled={tappedCount === 0} onClick={() => setUntapAmount((n) => Math.min(tappedCount, n + 1))} title="More to untap">
            +
          </button>
        </div>
        <span className="battlefield-stack-count" title="Cards still tappable">
          {untappedCount}
        </span>
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
      </div>
      <div className="stack-tap-row">
        <button className="stack-tap-commit" disabled={tappedCount === 0} onClick={() => onUntapN(clampedUntap)}>
          Untap
        </button>
        <button className="stack-tap-commit" disabled={untappedCount === 0} onClick={() => onTapN(clampedTap)}>
          Tap
        </button>
      </div>
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

const STACK_PEEK_STEP = 8;
const STACK_PEEK_MAX_LAYERS = 4;
const STACK_CONTROL_HEIGHT = 60;

export default function GameBoard({ state, yourPlayerId, actionError, onAction, soloControl }: GameBoardProps) {
  const you = state.players.find((p) => p.id === yourPlayerId)!;
  const opponent = state.players.find((p) => p.id !== yourPlayerId)!;
  const isYourTurn = soloControl ? true : state.activePlayerId === yourPlayerId;
  const mutualActive = state.mutualAdjustment.status === 'active';

  const [openPanelId, setOpenPanelId] = useState<string | null>(null);
  const [openZone, setOpenZone] = useState<{ playerId: string; zone: 'graveyard' | 'exile' } | null>(null);
  const [selectedAttackers, setSelectedAttackers] = useState<Set<string>>(new Set());
  const [blockerAssignments, setBlockerAssignments] = useState<Record<string, string[]>>({});
  const [pendingBlocker, setPendingBlocker] = useState<string | null>(null);
  const [draggedInstanceId, setDraggedInstanceId] = useState<string | null>(null);
  const [handOrder, setHandOrder] = useState<string[]>([]);
  const [boardOrder, setBoardOrder] = useState<Record<string, string[]>>({});
  const [winnerDismissed, setWinnerDismissed] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [phaseBoxPos, setPhaseBoxPos] = useState<{ x: number; y: number } | null>(null);
  const [manaChoiceQueue, setManaChoiceQueue] = useState<ManaChoiceItem[]>([]);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const phaseDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

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
  }, [state.turnNumber]);

  // A fresh combat starting (new attackers declared) always clears any
  // leftover blocker assignments from an earlier combat this same turn.
  useEffect(() => {
    setBlockerAssignments({});
    setPendingBlocker(null);
  }, [state.declaredAttackers]);

  const openCard = openPanelId ? findCard(state, openPanelId) : null;

  const isDeclaringAttackers = state.phase === 'declare_attackers' && state.activePlayerId === yourPlayerId;
  const isDeclaringBlockers = state.phase === 'declare_blockers' && state.activePlayerId !== yourPlayerId;
  const showCombatZones = isDeclaringAttackers || isDeclaringBlockers || state.phase === 'combat_damage' || state.phase === 'combat_end';
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

  function handleToggleTap(card: CardInstance) {
    const def = getCardDefinition(card.defId);
    if (!card.tapped && def.type === 'land' && def.producesMana) {
      if (Array.isArray(def.producesMana)) {
        enqueueManaChoice(card.instanceId, def.producesMana);
        return;
      }
      if (def.producesMana === 'any') {
        enqueueManaChoice(card.instanceId, ALL_MANA_COLORS);
        return;
      }
    }
    onAction({ type: 'TOGGLE_TAP', instanceId: card.instanceId });
  }

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

  function untapNFromGroup(group: CardInstance[], n: number) {
    group
      .filter((g) => g.tapped)
      .slice(0, n)
      .forEach((c) => handleToggleTap(c));
  }

  function handleBoardDrop(playerId: string) {
    if (!draggedInstanceId) return;
    const found = findCard(state, draggedInstanceId);
    if (!found) return;
    if (found.player.id !== playerId) return;
    if (found.zone === 'hand' || found.zone === 'commander') {
      handleCast(found.card);
    }
    setDraggedInstanceId(null);
  }

  function handleCast(card: CardInstance) {
    const def = getCardDefinition(card.defId);
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
          if (r.left < box.x + box.w && r.right > box.x && r.top < box.y + box.h && r.bottom > box.y) hits.add(id);
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
      if (def.type === 'land' && (Array.isArray(def.producesMana) || def.producesMana === 'any')) {
        enqueueManaChoice(id, Array.isArray(def.producesMana) ? def.producesMana : ALL_MANA_COLORS);
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
    frontProps: { selected?: boolean; onClick: () => void; onDoubleClick: () => void },
  ) {
    if (group.length === 1) {
      return <Card definition={getCardDefinition(front.defId)} instance={displayInstance(front)} {...frontProps} />;
    }
    const behind = group.filter((g) => g.instanceId !== front.instanceId);
    const depthOrder = [...behind.filter((g) => !g.tapped), ...behind.filter((g) => g.tapped)];
    const footprint = Math.min(depthOrder.length, STACK_PEEK_MAX_LAYERS) * STACK_PEEK_STEP;
    const tappedCount = group.filter((g) => g.tapped).length;
    const untappedCount = group.length - tappedCount;
    return (
      <div className="battlefield-stack" style={{ width: 185 + footprint, height: 248 + footprint + STACK_CONTROL_HEIGHT }}>
        {depthOrder.map((bc, i) => {
          const depth = Math.min(i + 1, STACK_PEEK_MAX_LAYERS) * STACK_PEEK_STEP;
          return (
            <div
              key={bc.instanceId}
              className="battlefield-stack-layer battlefield-stack-layer-back"
              style={{ transform: `translate(${depth}px, ${depth}px)`, zIndex: depthOrder.length - i }}
            >
              <Card definition={getCardDefinition(bc.defId)} instance={displayInstance(bc)} />
            </div>
          );
        })}
        {/* Stacked permanents are only tapped/untapped via this control strip,
            a chosen amount at a time, so it's always unambiguous which
            copies - and how much mana - is being added or refunded. */}
        <div style={{ position: 'absolute', top: 248 + footprint, left: 0, width: 185 + footprint, zIndex: depthOrder.length + 2 }}>
          <StackTapControls
            tappedCount={tappedCount}
            untappedCount={untappedCount}
            onTapN={(n) => tapNFromGroup(group, n)}
            onUntapN={(n) => untapNFromGroup(group, n)}
          />
        </div>
        <div className="battlefield-stack-layer" style={{ zIndex: depthOrder.length + 1 }}>
          <Card definition={getCardDefinition(front.defId)} instance={displayInstance(front)} selected={frontProps.selected} onClick={frontProps.onClick} />
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
    const canAttackThis = !isDead && isDeclaringAttackers && !isOpponentSide && !c.tapped && !c.summoningSick;
    const canBeBlocker = !isDead && isDeclaringBlockers && !isOpponentSide && !c.tapped;
    const combatDraggable = canAttackThis || canBeBlocker;
    const reorderAllowed = stackCount === 1 && !isDead && !isDeclaringAttackers && !isDeclaringBlockers && (!isOpponentSide || !!soloControl);
    // A row can also accept a drop of an already-selected attacker being
    // dragged back out to un-declare it, right up until "Attack with X" is pressed.
    const acceptsAttackerRemoval = isDeclaringAttackers && !isOpponentSide;
    const selected = pendingBlocker === c.instanceId || multiSelected.has(c.instanceId);

    return (
      <div key={c.instanceId} className={isDead ? 'destroyed-card-wrapper' : ''} ref={(el) => registerCardRef(c.instanceId, el)}>
        <div
          draggable={combatDraggable || reorderAllowed}
          onDragStart={() => setDraggedInstanceId(c.instanceId)}
          onDragOver={(e) => (reorderAllowed || acceptsAttackerRemoval) && e.preventDefault()}
          onDrop={() => {
            if (acceptsAttackerRemoval && draggedInstanceId && selectedAttackers.has(draggedInstanceId)) {
              removeAttacker(draggedInstanceId);
              setDraggedInstanceId(null);
            } else if (reorderAllowed && draggedInstanceId) {
              handleRowDrop(ownerId, 'creatures', rowCards, c.instanceId);
            }
          }}
        >
          {renderStackedCard(group, c, {
            selected,
            onClick: () => {
              if (isDead) return;
              if (canAttackThis) toggleAttacker(c.instanceId);
              else if (canBeBlocker) handleBlockerCandidateClick(c.instanceId);
              else setOpenPanelId(c.instanceId);
            },
            onDoubleClick: () => !isDead && stackCount === 1 && handleToggleTap(c),
          })}
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
    return (
      <div key={c.instanceId} ref={(el) => registerCardRef(c.instanceId, el)}>
        <div
          draggable={canReorder}
          onDragStart={() => canReorder && setDraggedInstanceId(c.instanceId)}
          onDragOver={(e) => reorderAllowed && e.preventDefault()}
          onDrop={() => reorderAllowed && draggedInstanceId && handleRowDrop(playerId, rowKey, rowCards, c.instanceId)}
        >
          {renderStackedCard(group, c, {
            selected: multiSelected.has(c.instanceId) || isPendingManaChoice,
            onClick: () => setOpenPanelId(c.instanceId),
            onDoubleClick: () => stackCount === 1 && handleToggleTap(c),
          })}
        </div>
      </div>
    );
  }

  function renderPlayerZone(player: PlayerState, isOpponentSide: boolean) {
    const { creatures, others, lands } = splitBattlefield(player.zones.battlefield);
    const visibleCreatures = creatures.filter((c) => !isInCombatZone(player.id, c.instanceId));
    const creatureGroups = groupForStacking(orderedRow(player.id, 'creatures', visibleCreatures), (c) => state.pendingDeaths.includes(c.instanceId));
    const otherGroups = groupForStacking(orderedRow(player.id, 'others', others));
    const landGroups = groupForStacking(orderedRow(player.id, 'lands', lands));
    const commanderCard = player.zones.commander[0];
    const isDrawStep = state.phase === 'draw' && state.activePlayerId === player.id && !player.hasDrawnThisTurn;
    const canDrawHere = player.id === yourPlayerId || (soloControl && isOpponentSide);
    const selectEnabled = !isOpponentSide || !!soloControl;
    const isControllersTurn = state.activePlayerId === player.id;

    const commanderColumn = (
      <div className="corner-column">
        <div className="corner-label">Commander</div>
        {commanderCard ? (
          <Card definition={getCardDefinition(commanderCard.defId)} instance={commanderCard} onClick={() => setOpenPanelId(commanderCard.instanceId)} />
        ) : (
          <div className="corner-box">In play</div>
        )}
        <div
          className={`library-stack ${isDrawStep ? 'library-stack-draw-highlight' : ''} ${canDrawHere ? 'library-stack-clickable' : ''}`}
          onClick={() => canDrawHere && onAction({ type: 'DRAW_CARD' }, player.id)}
          title={canDrawHere ? 'Click to draw' : ''}
        >
          <Card definition={{ id: '', name: '', type: 'creature', costLabel: '', text: '', imagePath: '' }} faceDown />
          <span className="library-stack-count">{player.zones.library.length}</span>
        </div>
      </div>
    );

    const graveyardExileColumn = (
      <div className="corner-column">
        {(['graveyard', 'exile'] as const).map((zoneName) => {
          const cards = player.zones[zoneName];
          const topCard = cards[cards.length - 1];
          return (
            <div key={zoneName} className="zone-pile" onClick={() => setOpenZone({ playerId: player.id, zone: zoneName })}>
              {topCard ? <Card definition={getCardDefinition(topCard.defId)} /> : <div className="card card-empty-pile" />}
              <span className="zone-pile-label">
                {zoneName === 'graveyard' ? 'Graveyard' : 'Exile'} ({cards.length})
              </span>
            </div>
          );
        })}
      </div>
    );

    const battlefieldRows = isOpponentSide ? (
      <>
        <div className="battlefield-row lands-row">{landGroups.map((g) => renderPlainCard(g, player.id, 'lands', lands, selectEnabled))}</div>
        <div className="battlefield-row others-row">{otherGroups.map((g) => renderPlainCard(g, player.id, 'others', others, selectEnabled))}</div>
        <div className="battlefield-row creatures-row">{creatureGroups.map((g) => renderCreatureCard(g, isOpponentSide, visibleCreatures, player.id))}</div>
      </>
    ) : (
      <>
        <div className="battlefield-row creatures-row">{creatureGroups.map((g) => renderCreatureCard(g, isOpponentSide, visibleCreatures, player.id))}</div>
        <div className="battlefield-row others-row">{otherGroups.map((g) => renderPlainCard(g, player.id, 'others', others, selectEnabled))}</div>
        <div className="battlefield-row lands-row">{landGroups.map((g) => renderPlainCard(g, player.id, 'lands', lands, selectEnabled))}</div>
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

    const handRow = (
      <div className={`hand-fan ${isOpponentSide ? 'opponent-hand' : 'your-hand'}`}>
        {isOpponentSide
          ? player.zones.hand.map((c) => <Card key={c.instanceId} definition={getCardDefinition(c.defId)} faceDown />)
          : orderedHand(player.zones.hand).map((c, i, arr) => {
            const def = getCardDefinition(c.defId);
            const affordable = def.type === 'land' || canPay(player.manaPool, parseCostLabel(def.costLabel), 0);
            const isInstantSpeed = def.type === 'instant' || hasKeyword(def.text, 'flash');
            const dimmed = !(isControllersTurn || isInstantSpeed) || !affordable;
            const mid = (arr.length - 1) / 2;
            const offset = i - mid;
            return (
              <div
                key={c.instanceId}
                className="hand-fan-card"
                style={{ transform: `rotate(${offset * 4}deg) translateY(${Math.abs(offset) * 6}px)`, zIndex: i }}
                draggable
                onDragStart={() => setDraggedInstanceId(c.instanceId)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleHandDrop(player.id, c.instanceId)}
              >
                <Card definition={def} instance={c} dimmed={dimmed} onClick={() => setOpenPanelId(c.instanceId)} />
              </div>
            );
          })}
      </div>
    );

    const lifeRow = (
      <div className="life-row">
        <div className="life-total-group">
          <span className="life-total">
            {player.name}: {player.life} life
          </span>
          {player.commanderDamageTaken > 0 && <span className="commander-damage-badge">Commander dmg: {player.commanderDamageTaken}</span>}
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
        <ManaRow player={player} />
      </div>
    );

    return (
      <section className={`player-zone ${isOpponentSide ? 'opponent-zone' : 'your-zone'}`}>
        {isOpponentSide && lifeRow}
        {isOpponentSide && handRow}
        <div className="zone-top-row">
          {isOpponentSide ? (
            <>
              {graveyardExileColumn}
              {centerColumn}
              {commanderColumn}
            </>
          ) : (
            <>
              {commanderColumn}
              {centerColumn}
              {graveyardExileColumn}
            </>
          )}
        </div>
        {!isOpponentSide && handRow}
        {!isOpponentSide && lifeRow}
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

  const combatZoneEl = showCombatZones && (
    <div className="combat-zone-merged">
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
        {(isDeclaringAttackers ? Array.from(selectedAttackers) : state.declaredAttackers).map((id) => {
          const found = findCard(state, id);
          if (!found) return null;
          const attackerIsDead = state.pendingDeaths.includes(id);
          const blockers = isDeclaringAttackers ? [] : blockersFor(id);
          return (
            <div key={id} className="combat-column">
              <div
                className={`combat-attacker-cell ${attackerIsDead ? 'destroyed-card-wrapper' : ''}`}
                draggable={isDeclaringAttackers}
                onDragStart={() => isDeclaringAttackers && setDraggedInstanceId(id)}
              >
                <Card
                  definition={getCardDefinition(found.card.defId)}
                  instance={{ ...found.card, tapped: false }}
                  onClick={() => isDeclaringAttackers && toggleAttacker(id)}
                />
              </div>
              {blockerSlotsVisible && (
                <div
                  className="combat-blocker-slot"
                  onDragOver={(e) => isDeclaringBlockers && e.preventDefault()}
                  onDrop={() => {
                    if (isDeclaringBlockers && draggedInstanceId) {
                      assignBlocker(id, draggedInstanceId);
                      setDraggedInstanceId(null);
                    }
                  }}
                  onClick={() => isDeclaringBlockers && handleAttackerClickForBlocking(id)}
                >
                  {blockers.length === 0 ? (
                    <span className="combat-blocker-slot-empty">{isDeclaringBlockers ? 'Drop blocker here' : 'No blockers'}</span>
                  ) : (
                    blockers.map((bId, i) => {
                      const bf = findCard(state, bId);
                      if (!bf) return null;
                      const blockerIsDead = state.pendingDeaths.includes(bId);
                      return (
                        <div
                          key={bId}
                          className={`combat-blocker-stacked ${blockerIsDead ? 'destroyed-card-wrapper' : ''}`}
                          style={{ marginTop: i > 0 ? -248 : 0, zIndex: i }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isDeclaringBlockers) removeBlockerAssignment(id, bId);
                          }}
                          title={isDeclaringBlockers ? 'Click to remove this blocker' : ''}
                        >
                          <Card definition={getCardDefinition(bf.card.defId)} instance={{ ...bf.card, tapped: false }} />
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
        {isDeclaringAttackers && selectedAttackers.size === 0 && <p className="combat-zone-empty">Nothing here yet</p>}
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

      <div className="game-board-main">
        {state.winnerId && !winnerDismissed && (
          <div className="winner-overlay" onClick={() => setWinnerDismissed(true)}>
            <div className="winner-banner" onClick={(e) => e.stopPropagation()}>
              {state.winnerId === yourPlayerId ? 'You win!' : `${opponent.name} wins.`}
              <div className="winner-dismiss-hint">Click anywhere to close</div>
            </div>
          </div>
        )}

        {renderPlayerZone(opponent, true)}

        {combatZoneEl}

        {renderPlayerZone(you, false)}
      </div>

      <EventLog log={state.log} />

      <div className="bottom-left-controls">
        <button className="undo-button" onClick={() => onAction({ type: 'UNDO' })} title="Step back through recent actions">
          {'\u21b6'} Undo
        </button>
        <MutualAdjustmentControls
          state={state}
          yourPlayerId={yourPlayerId}
          onRequest={() => onAction({ type: 'REQUEST_MUTUAL_ADJUSTMENT' }, yourPlayerId)}
          onRespond={(accept) => onAction({ type: 'RESPOND_MUTUAL_ADJUSTMENT', accept }, yourPlayerId)}
          onRequestExit={() => onAction({ type: 'REQUEST_EXIT_MUTUAL_ADJUSTMENT' }, yourPlayerId)}
          onRespondExit={(accept) => onAction({ type: 'RESPOND_EXIT_MUTUAL_ADJUSTMENT', accept }, yourPlayerId)}
        />
        <button className="concede-button" onClick={() => onAction({ type: 'CONCEDE' }, yourPlayerId)}>
          Concede
        </button>
      </div>

      <div
        className="bottom-right-controls"
        onMouseDown={startPhaseDrag}
        style={phaseBoxPos ? { left: phaseBoxPos.x, top: phaseBoxPos.y, right: 'auto', bottom: 'auto' } : undefined}
      >
        <PhaseBar
          phase={state.phase}
          turnNumber={state.turnNumber}
          isYourTurn={isYourTurn || state.phase === 'combat_damage'}
          nextLabel={nextLabel}
          hideEndTurn={isDeclaringAttackers || isDeclaringBlockers || state.phase === 'combat_damage'}
          nextDisabled={state.phase === 'combat_damage' && youAreReadyForCombat}
          onNextPhase={() => {
            if (isDeclaringAttackers) confirmAttackers();
            else if (isDeclaringBlockers) confirmBlockers();
            else onAction({ type: 'NEXT_PHASE' }, yourPlayerId);
          }}
          onEndTurn={() => onAction({ type: 'END_TURN' }, state.activePlayerId)}
        />
        {phaseBoxPos && (
          <button className="phase-bar-compact-button secondary reset-position-button" onClick={() => setPhaseBoxPos(null)}>
            Reset turn box location
          </button>
        )}
      </div>

      {openCard && (
        <CardActionsPanel
          definition={getCardDefinition(openCard.card.defId)}
          instance={openCard.card}
          currentZone={openCard.zone}
          ownerManaPool={openCard.player.manaPool}
          ownerCommanderDefId={openCard.player.commanderDefId}
          mutualActive={mutualActive}
          isMyTurn={state.activePlayerId === openCard.player.id}
          alreadyPlayedLand={openCard.player.hasPlayedLandThisTurn}
          attachedToName={
            openCard.card.attachedToInstanceId ? getCardDefinition(findCard(state, openCard.card.attachedToInstanceId)?.card.defId ?? '')?.name ?? null : null
          }
          manaOptions={(() => {
            const def = getCardDefinition(openCard.card.defId);
            if (def.type !== 'land' || !def.producesMana) return undefined;
            if (Array.isArray(def.producesMana)) return def.producesMana;
            if (def.producesMana === 'any') return ALL_MANA_COLORS;
            return undefined;
          })()}
          onToggleTap={() => {
            onAction({ type: 'TOGGLE_TAP', instanceId: openCard.card.instanceId });
            setOpenPanelId(null);
          }}
          onChooseTapColor={(color) => {
            onAction({ type: 'TOGGLE_TAP', instanceId: openCard.card.instanceId, chosenColor: color });
            setOpenPanelId(null);
          }}
          onFlip={() => onAction({ type: 'FLIP_CARD', instanceId: openCard.card.instanceId })}
          onCast={() => handleCast(openCard.card)}
          onActivateAbility={(abilityId) => onAction({ type: 'ACTIVATE_ABILITY', instanceId: openCard.card.instanceId, abilityId })}
          onMove={(toZone) => {
            onAction({ type: 'MOVE_CARD', instanceId: openCard.card.instanceId, toZone });
            setOpenPanelId(null);
          }}
          onAdjustCounter={(label, delta) => onAction({ type: 'ADJUST_COUNTER', instanceId: openCard.card.instanceId, label, delta })}
          onStartAttach={() => setOpenPanelId(null)}
          onDetach={() => {
            onAction({ type: 'DETACH_CARD', instanceId: openCard.card.instanceId });
            setOpenPanelId(null);
          }}
          onClose={() => setOpenPanelId(null)}
        />
      )}

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

      {actionError && <div className="action-error-banner action-error-bottom">{actionError}</div>}
    </div>
  );
}