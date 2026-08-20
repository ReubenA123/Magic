import React, { useState } from 'react';
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
  if (total === 0) return <div className="mana-row mana-row-empty">No mana available</div>;
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

  const openCard = openPanelId ? findCard(state, openPanelId) : null;

  const isDeclaringAttackers = state.phase === 'declare_attackers' && (soloControl || state.activePlayerId === yourPlayerId);
  const isDeclaringBlockers = state.phase === 'declare_blockers' && (soloControl || state.activePlayerId !== yourPlayerId);

  const [draggedInstanceId, setDraggedInstanceId] = useState<string | null>(null);
  const [handOrder, setHandOrder] = useState<string[]>([]);

  function orderedHand(hand: CardInstance[]): CardInstance[] {
    const byId = new Map(hand.map((c) => [c.instanceId, c]));
    const ordered = handOrder.map((id) => byId.get(id)).filter((c): c is CardInstance => !!c);
    const missing = hand.filter((c) => !handOrder.includes(c.instanceId));
    return [...ordered, ...missing];
  }

  function handleHandDrop(playerId: string, targetInstanceId: string) {
    if (!draggedInstanceId || draggedInstanceId === targetInstanceId) return;
    const you = state.players.find((p) => p.id === playerId)!;
    const current = orderedHand(you.zones.hand).map((c) => c.instanceId);
    const fromIndex = current.indexOf(draggedInstanceId);
    const toIndex = current.indexOf(targetInstanceId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...current];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, draggedInstanceId);
    setHandOrder(next);
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

  function confirmAttackers() {
    onAction({ type: 'DECLARE_ATTACKERS', instanceIds: Array.from(selectedAttackers) }, state.activePlayerId);
    setSelectedAttackers(new Set());
  }

  function handleBlockerCandidateClick(instanceId: string) {
    setPendingBlocker(instanceId === pendingBlocker ? null : instanceId);
  }

  function handleAttackerClickForBlocking(attackerInstanceId: string) {
    if (!pendingBlocker) return;
    setBlockerAssignments((prev) => ({ ...prev, [attackerInstanceId]: [...(prev[attackerInstanceId] || []), pendingBlocker] }));
    setPendingBlocker(null);
  }

  function confirmBlockers() {
    const assignments = Object.entries(blockerAssignments).map(([attackerInstanceId, blockerInstanceIds]) => ({ attackerInstanceId, blockerInstanceIds }));
    const defenderId = soloControl ? opponent.id : yourPlayerId;
    onAction({ type: 'DECLARE_BLOCKERS', assignments }, defenderId);
    setBlockerAssignments({});
  }

  function renderCreatureCard(c: CardInstance, isOpponentSide: boolean) {
    const isAttacker = state.declaredAttackers.includes(c.instanceId);
    const def = getCardDefinition(c.defId);
    const canBeBlockTarget = isDeclaringBlockers && isOpponentSide && isAttacker;
    const canAttackThis = isDeclaringAttackers && !isOpponentSide && !c.tapped && !c.summoningSick;
    const canBeBlocker = isDeclaringBlockers && !isOpponentSide && !c.tapped;
    const selected = selectedAttackers.has(c.instanceId) || pendingBlocker === c.instanceId;
    return (
      <div key={c.instanceId} className={isAttacker ? 'attacking-creature' : ''}>
        <Card
          definition={def}
          instance={c}
          selected={selected}
          onClick={() => {
            if (canBeBlockTarget) handleAttackerClickForBlocking(c.instanceId);
            else if (canAttackThis) toggleAttacker(c.instanceId);
            else if (canBeBlocker) handleBlockerCandidateClick(c.instanceId);
            else setOpenPanelId(c.instanceId);
          }}
        />
      </div>
    );
  }

  function renderPlainCard(c: CardInstance) {
    const def = getCardDefinition(c.defId);
    return <Card key={c.instanceId} definition={def} instance={c} onClick={() => setOpenPanelId(c.instanceId)} />;
  }

  function renderPlayerZone(player: PlayerState, isOpponentSide: boolean) {
    const { creatures, others, lands } = splitBattlefield(player.zones.battlefield);
    const commanderCard = player.zones.commander[0];

    return (
      <section className={`player-zone ${isOpponentSide ? 'opponent-zone' : 'your-zone'}`}>
        <div className="mana-row-wrapper">
          <ManaRow player={player} />
        </div>

        <div className="zone-top-row">
          <div className="corner-column">
            <div className="corner-label">Commander</div>
            {commanderCard ? (
              <Card definition={getCardDefinition(commanderCard.defId)} instance={commanderCard} onClick={() => setOpenPanelId(commanderCard.instanceId)} />
            ) : (
              <div className="corner-box">Not in zone</div>
            )}
            {(() => {
              const isDrawStep = state.phase === 'draw' && state.activePlayerId === player.id;
              const canDrawHere = player.id === yourPlayerId || (soloControl && isOpponentSide);
              return (
                <div
                  className={`library-stack ${isDrawStep ? 'library-stack-draw-highlight' : ''} ${canDrawHere ? 'library-stack-clickable' : ''}`}
                  onClick={() => canDrawHere && onAction({ type: 'DRAW_CARD' }, player.id)}
                  title={canDrawHere ? 'Click to draw' : ''}
                >
                  <div className="card card-back" />
                  <span className="library-stack-count">{player.zones.library.length}</span>
                </div>
              );
            })()}
          </div>

          <div className="zone-center-column">
            <div className="battlefield-row creatures-row">{creatures.map((c) => renderCreatureCard(c, isOpponentSide))}</div>
            <div className="battlefield-row others-row">{others.map(renderPlainCard)}</div>
            <div className="battlefield-row lands-row">{lands.map(renderPlainCard)}</div>
          </div>

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
        </div>

        <div className={`hand-fan ${isOpponentSide ? 'opponent-hand' : 'your-hand'}`}>
          {isOpponentSide
            ? player.zones.hand.map((c) => <Card key={c.instanceId} definition={getCardDefinition(c.defId)} faceDown />)
            : (isOpponentSide ? player.zones.hand : orderedHand(player.zones.hand)).map((c, i, arr) => {
              const def = getCardDefinition(c.defId);
              const affordable = def.type === 'land' || canPay(player.manaPool, parseCostLabel(def.costLabel), 0);
              const mid = (arr.length - 1) / 2;
              const offset = i - mid;
              const rotate = offset * 4;
              const lift = Math.abs(offset) * 6;
              return (
                <div
                  key={c.instanceId}
                  className="hand-fan-card"
                  style={{ transform: `rotate(${rotate}deg) translateY(${lift}px)`, zIndex: i }}
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
        <div className="life-row">
          <div className="life-total-group">
            <span className="life-total">
              {player.name}: {player.life} life
            </span>
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
          {(isOpponentSide ? soloControl : true) && (
            <button className="draw-button" onClick={() => onAction({ type: 'DRAW_CARD' }, player.id)}>
              Draw
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="game-board-layout">
      <div className="game-board-main">
        {state.winnerId && (
          <div className="winner-overlay">
            <div className="winner-banner">{state.winnerId === yourPlayerId ? 'You win!' : `${opponent.name} wins.`}</div>
          </div>
        )}
        {renderPlayerZone(opponent, true)}

        {isDeclaringAttackers && (
          <div className="combat-controls">
            <button onClick={confirmAttackers}>{selectedAttackers.size > 0 ? `Attack with ${selectedAttackers.size}` : 'Declare no attackers'}</button>
          </div>
        )}
        {isDeclaringBlockers && (
          <div className="combat-controls">
            <p className="combat-hint">Click one of your creatures, then click an attacker above to block it.</p>
            <button onClick={confirmBlockers}>Confirm blockers</button>
          </div>
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

      <div className="bottom-right-controls">
        <PhaseBar
          phase={state.phase}
          turnNumber={state.turnNumber}
          isYourTurn={isYourTurn}
          onNextPhase={() => onAction({ type: 'NEXT_PHASE' }, state.activePlayerId)}
          onEndTurn={() => onAction({ type: 'END_TURN' }, state.activePlayerId)}
        />
      </div>

      <div className="bottom-right-controls">
        <PhaseBar
          phase={state.phase}
          turnNumber={state.turnNumber}
          isYourTurn={isYourTurn}
          onNextPhase={() => onAction({ type: 'NEXT_PHASE' }, state.activePlayerId)}
          onEndTurn={() => onAction({ type: 'END_TURN' }, state.activePlayerId)}
        />
      </div>

      {openCard && (
        <CardActionsPanel
          definition={getCardDefinition(openCard.card.defId)}
          instance={openCard.card}
          currentZone={openCard.zone}
          ownerManaPool={openCard.player.manaPool}
          ownerCommanderDefId={openCard.player.commanderDefId}
          mutualActive={mutualActive}
          onToggleTap={() => handleToggleTap(openCard.card)}
          onFlip={() => onAction({ type: 'FLIP_CARD', instanceId: openCard.card.instanceId })}
          onCast={() => handleCast(openCard.card)}
          onActivateAbility={(abilityId) => onAction({ type: 'ACTIVATE_ABILITY', instanceId: openCard.card.instanceId, abilityId })}
          onMove={(toZone) => {
            onAction({ type: 'MOVE_CARD', instanceId: openCard.card.instanceId, toZone });
            setOpenPanelId(null);
          }}
          onAdjustCounter={(label, delta) => onAction({ type: 'ADJUST_COUNTER', instanceId: openCard.card.instanceId, label, delta })}
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