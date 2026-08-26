import React, { useEffect, useRef, useState } from 'react';
import { CardInstance, GameAction, GameState, ManaColor, PlayerState, ZoneName } from '../types';
import { getCardDefinition } from '../data/cards';
import { parseCostLabel, canPay } from '../engine/mana';
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

interface SelectionBox {
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

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

  const openCard = openPanelId ? findCard(state, openPanelId) : null;

  const isDeclaringAttackers = state.phase === 'declare_attackers' && (soloControl || state.activePlayerId === yourPlayerId);
  const isDeclaringBlockers = state.phase === 'declare_blockers' && (soloControl || state.activePlayerId !== yourPlayerId);

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

  function handleToggleTap(card: CardInstance) {
    const def = getCardDefinition(card.defId);
    if (!card.tapped && def.type === 'land' && def.producesMana) {
      if (Array.isArray(def.producesMana)) {
        const choice = window.prompt(`Choose a colour to produce (${def.producesMana.join(', ')}):`, def.producesMana[0]);
        const upper = (choice ?? '').trim().toUpperCase();
        if (!def.producesMana.includes(upper as ManaColor)) return;
        onAction({ type: 'TOGGLE_TAP', instanceId: card.instanceId, chosenColor: upper as ManaColor });
        return;
      }
      if (def.producesMana === 'any') {
        const choice = window.prompt('Choose a colour to produce (W, U, B, R, G, or C for colourless):', 'C');
        const upper = (choice ?? '').trim().toUpperCase();
        if (!['W', 'U', 'B', 'R', 'G', 'C'].includes(upper)) return;
        onAction({ type: 'TOGGLE_TAP', instanceId: card.instanceId, chosenColor: upper as ManaColor });
        return;
      }
    }
    onAction({ type: 'TOGGLE_TAP', instanceId: card.instanceId });
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

  function confirmAttackers() {
    onAction({ type: 'DECLARE_ATTACKERS', instanceIds: Array.from(selectedAttackers) }, state.activePlayerId);
    setSelectedAttackers(new Set());
  }

  function handleBlockerCandidateClick(instanceId: string) {
    setPendingBlocker(instanceId === pendingBlocker ? null : instanceId);
  }

  function assignBlocker(attackerInstanceId: string, blockerInstanceId: string) {
    setBlockerAssignments((prev) => ({ ...prev, [attackerInstanceId]: [...(prev[attackerInstanceId] || []), blockerInstanceId] }));
  }

  function handleAttackerClickForBlocking(attackerInstanceId: string) {
    if (!pendingBlocker) return;
    assignBlocker(attackerInstanceId, pendingBlocker);
    setPendingBlocker(null);
  }

  function confirmBlockers() {
    const assignments = Object.entries(blockerAssignments).map(([attackerInstanceId, blockerInstanceIds]) => ({ attackerInstanceId, blockerInstanceIds }));
    const defenderId = state.players.find((p) => p.id !== state.activePlayerId)!.id;
    onAction({ type: 'DECLARE_BLOCKERS', assignments }, defenderId);
    setBlockerAssignments({});
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
      if (found && found.zone === 'battlefield' && !found.card.tapped) {
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

  function renderCreatureCard(c: CardInstance, isOpponentSide: boolean, rowCards: CardInstance[]) {
    const isDead = state.pendingDeaths.includes(c.instanceId);
    const isAttacker = state.declaredAttackers.includes(c.instanceId);
    const def = getCardDefinition(c.defId);
    const canBeBlockTarget = !isDead && isDeclaringBlockers && isOpponentSide && isAttacker;
    const canAttackThis = !isDead && isDeclaringAttackers && !isOpponentSide && !c.tapped && !c.summoningSick;
    const canBeBlocker = !isDead && isDeclaringBlockers && !isOpponentSide && !c.tapped;
    const combatDraggable = canAttackThis || canBeBlocker;
    const reorderAllowed = !isDead && !isDeclaringAttackers && !isDeclaringBlockers && (!isOpponentSide || !!soloControl);
    const selected = selectedAttackers.has(c.instanceId) || pendingBlocker === c.instanceId || multiSelected.has(c.instanceId);

    return (
      <div key={c.instanceId} className={`${isAttacker ? 'attacking-creature' : ''} ${isDead ? 'destroyed-card-wrapper' : ''}`} ref={(el) => registerCardRef(c.instanceId, el)}>
        <div
          draggable={combatDraggable || reorderAllowed}
          onDragStart={() => setDraggedInstanceId(c.instanceId)}
          onDragOver={(e) => (canBeBlockTarget || reorderAllowed) && e.preventDefault()}
          onDrop={() => {
            if (canBeBlockTarget && draggedInstanceId) {
              assignBlocker(c.instanceId, draggedInstanceId);
              setDraggedInstanceId(null);
            } else if (reorderAllowed && draggedInstanceId) {
              handleRowDrop(isOpponentSide ? opponent.id : you.id, 'creatures', rowCards, c.instanceId);
            }
          }}
        >
          <Card
            definition={def}
            instance={c}
            selected={selected}
            onClick={() => {
              if (isDead) return;
              if (canBeBlockTarget) handleAttackerClickForBlocking(c.instanceId);
              else if (canAttackThis) toggleAttacker(c.instanceId);
              else if (canBeBlocker) handleBlockerCandidateClick(c.instanceId);
              else setOpenPanelId(c.instanceId);
            }}
            onDoubleClick={() => !isDead && handleToggleTap(c)}
          />
        </div>
      </div>
    );
  }

  function renderPlainCard(c: CardInstance, playerId: string, rowKey: string, rowCards: CardInstance[], reorderAllowed: boolean) {
    const def = getCardDefinition(c.defId);
    const isAttachTarget = false;
    return (
      <div key={c.instanceId} ref={(el) => registerCardRef(c.instanceId, el)}>
        <div
          draggable={reorderAllowed}
          onDragStart={() => reorderAllowed && setDraggedInstanceId(c.instanceId)}
          onDragOver={(e) => reorderAllowed && e.preventDefault()}
          onDrop={() => reorderAllowed && draggedInstanceId && handleRowDrop(playerId, rowKey, rowCards, c.instanceId)}
        >
          <Card
            definition={def}
            instance={c}
            selected={multiSelected.has(c.instanceId) || isAttachTarget}
            onClick={() => setOpenPanelId(c.instanceId)}
            onDoubleClick={() => handleToggleTap(c)}
          />
        </div>
      </div>
    );
  }

  function renderPlayerZone(player: PlayerState, isOpponentSide: boolean) {
    const { creatures, others, lands } = splitBattlefield(player.zones.battlefield);
    const orderedCreatures = orderedRow(player.id, 'creatures', creatures);
    const orderedOthers = orderedRow(player.id, 'others', others);
    const orderedLands = orderedRow(player.id, 'lands', lands);
    const commanderCard = player.zones.commander[0];
    const isDrawStep = state.phase === 'draw' && state.activePlayerId === player.id && !player.hasDrawnThisTurn;
    const canDrawHere = player.id === yourPlayerId || (soloControl && isOpponentSide);
    const selectEnabled = !isOpponentSide || !!soloControl;

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
        <div className="battlefield-row lands-row">{orderedLands.map((c) => renderPlainCard(c, player.id, 'lands', lands, selectEnabled))}</div>
        <div className="battlefield-row others-row">{orderedOthers.map((c) => renderPlainCard(c, player.id, 'others', others, selectEnabled))}</div>
        <div className="battlefield-row creatures-row">{orderedCreatures.map((c) => renderCreatureCard(c, isOpponentSide, creatures))}</div>
      </>
    ) : (
      <>
        <div className="battlefield-row creatures-row">{orderedCreatures.map((c) => renderCreatureCard(c, isOpponentSide, creatures))}</div>
        <div className="battlefield-row others-row">{orderedOthers.map((c) => renderPlainCard(c, player.id, 'others', others, selectEnabled))}</div>
        <div className="battlefield-row lands-row">{orderedLands.map((c) => renderPlainCard(c, player.id, 'lands', lands, selectEnabled))}</div>
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
                  <Card definition={def} instance={c} dimmed={!affordable} onClick={() => setOpenPanelId(c.instanceId)} />
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

        {isDeclaringAttackers && (
          <div
            className="combat-zone combat-zone-attack"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedInstanceId) {
                addAttackerFromDrag(draggedInstanceId);
                setDraggedInstanceId(null);
              }
            }}
          >
            <div className="combat-zone-label combat-zone-label-attack">Attacking {'\u2014'} drag your creatures here</div>
            <div className="combat-zone-row">
              {Array.from(selectedAttackers).map((id) => {
                const found = findCard(state, id);
                if (!found) return null;
                return <Card key={id} definition={getCardDefinition(found.card.defId)} instance={found.card} onClick={() => toggleAttacker(id)} />;
              })}
              {selectedAttackers.size === 0 && <p className="combat-zone-empty">Nothing here yet</p>}
            </div>
            <button className="phase-bar-compact-button" onClick={confirmAttackers}>
              {selectedAttackers.size > 0 ? `Attack with ${selectedAttackers.size}` : 'Declare no attackers'}
            </button>
          </div>
        )}

        {isDeclaringBlockers && (
          <>
            <div className="combat-zone combat-zone-attack">
              <div className="combat-zone-label combat-zone-label-attack">Attacking</div>
              <div className="combat-zone-row">
                {state.declaredAttackers.map((id) => {
                  const found = findCard(state, id);
                  if (!found) return null;
                  const blockers = blockerAssignments[id] || [];
                  return (
                    <div
                      key={id}
                      className="combat-attacker-slot"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedInstanceId) {
                          assignBlocker(id, draggedInstanceId);
                          setDraggedInstanceId(null);
                        }
                      }}
                    >
                      <Card definition={getCardDefinition(found.card.defId)} instance={found.card} />
                      <div className="combat-blockers-row">
                        {blockers.map((bId) => {
                          const bf = findCard(state, bId);
                          return bf ? <Card key={bId} definition={getCardDefinition(bf.card.defId)} instance={bf.card} /> : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="combat-zone combat-zone-block">
              <div className="combat-zone-label combat-zone-label-block">Blocking {'\u2014'} drag your creatures onto an attacker above</div>
              <div className="combat-zone-row">
                {state.players
                  .find((p) => p.id !== state.activePlayerId)!
                  .zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature' && !c.tapped)
                  .filter((c) => !Object.values(blockerAssignments).flat().includes(c.instanceId))
                  .map((c) => (
                    <div key={c.instanceId} draggable onDragStart={() => setDraggedInstanceId(c.instanceId)}>
                      <Card definition={getCardDefinition(c.defId)} instance={c} onClick={() => handleBlockerCandidateClick(c.instanceId)} selected={pendingBlocker === c.instanceId} />
                    </div>
                  ))}
              </div>
              <button className="phase-bar-compact-button" onClick={confirmBlockers}>
                Confirm blockers
              </button>
            </div>
          </>
        )}

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
          isYourTurn={isYourTurn}
          hideControls={isDeclaringAttackers || isDeclaringBlockers}
          onNextPhase={() => onAction({ type: 'NEXT_PHASE' }, state.activePlayerId)}
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
          onToggleTap={() => handleToggleTap(openCard.card)}
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