import React, { useMemo, useState } from 'react';
import { CardInstance, GameAction, GameState, ManaColor, PlayerState, ZoneName } from '../types';
import { getCardDefinition } from '../data/cards';
import { parseCostLabel } from '../engine/mana';
import Card from './Card';
import PhaseBar from './PhaseBar';
import CardActionsPanel from './CardActionsPanel';
import ZoneModal from './ZoneModal';

interface GameBoardProps {
  state: GameState;
  yourPlayerId: string;
  actionError: string | null;
  onAction: (action: GameAction, actingPlayerId?: string) => void;
  soloControl?: boolean;
}

const LIFE_STEPS = [-5, -1, 1, 5];
const MANA_COLOR_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

function findCard(state: GameState, instanceId: string): { player: PlayerState; zone: ZoneName; card: CardInstance } | null {
  for (const player of state.players) {
    const zoneNames: ZoneName[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile'];
    for (const zone of zoneNames) {
      const card = player.zones[zone].find((c) => c.instanceId === instanceId);
      if (card) return { player, zone, card };
    }
  }
  return null;
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

  const [openPanelId, setOpenPanelId] = useState<string | null>(null);
  const [openZone, setOpenZone] = useState<{ playerId: string; zone: 'graveyard' | 'exile' } | null>(null);
  const [selectedAttackers, setSelectedAttackers] = useState<Set<string>>(new Set());
  const [blockerAssignments, setBlockerAssignments] = useState<Record<string, string[]>>({});
  const [pendingBlocker, setPendingBlocker] = useState<string | null>(null);

  const recentLog = useMemo(() => state.log.slice(-10), [state.log]);
  const openCard = openPanelId ? findCard(state, openPanelId) : null;

  const isDeclaringAttackers = state.phase === 'declare_attackers' && (soloControl || state.activePlayerId === yourPlayerId);
  const isDeclaringBlockers = state.phase === 'declare_blockers' && (soloControl || state.activePlayerId !== yourPlayerId);

  function adjustLife(playerId: string, delta: number) {
    onAction({ type: 'ADJUST_LIFE', playerId, delta });
  }

  function handleToggleTap(card: CardInstance) {
    const def = getCardDefinition(card.defId);
    if (!card.tapped && def.type === 'land' && def.producesMana === 'any') {
      const chosen = window.prompt('Choose a colour to produce (W, U, B, R, G, or C for colourless):', 'C');
      const upper = (chosen ?? '').trim().toUpperCase();
      if (!['W', 'U', 'B', 'R', 'G', 'C'].includes(upper)) return;
      onAction({ type: 'TOGGLE_TAP', instanceId: card.instanceId, chosenColor: upper as ManaColor });
      return;
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

  function renderBattlefield(player: PlayerState, isOpponentSide: boolean) {
    return (
      <div className="battlefield-row">
        {player.zones.battlefield.map((c) => {
          const isAttacker = state.declaredAttackers.includes(c.instanceId);
          const def = getCardDefinition(c.defId);
          const canBeBlockTarget = isDeclaringBlockers && isOpponentSide && isAttacker;
          const canAttackThis = isDeclaringAttackers && !isOpponentSide && def.type === 'creature' && !c.tapped && !c.summoningSick;
          const canBeBlocker = isDeclaringBlockers && !isOpponentSide && def.type === 'creature' && !c.tapped;
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
        })}
      </div>
    );
  }

  function renderZoneCounts(player: PlayerState) {
    return (
      <div className="zone-counts">
        <button className="zone-count-button" onClick={() => setOpenZone({ playerId: player.id, zone: 'graveyard' })}>
          Graveyard ({player.zones.graveyard.length})
        </button>
        <button className="zone-count-button" onClick={() => setOpenZone({ playerId: player.id, zone: 'exile' })}>
          Exile ({player.zones.exile.length})
        </button>
        <span className="library-count">Library: {player.zones.library.length}</span>
      </div>
    );
  }

  return (
    <div className="game-board">
      <PhaseBar
        phase={state.phase}
        turnNumber={state.turnNumber}
        isYourTurn={isYourTurn}
        onNextPhase={() => onAction({ type: 'NEXT_PHASE' }, state.activePlayerId)}
        onEndTurn={() => onAction({ type: 'END_TURN' }, state.activePlayerId)}
      />

      {actionError && <div className="action-error-banner">{actionError}</div>}
      {state.winnerId && <div className="winner-banner">{state.winnerId === yourPlayerId ? 'You win!' : `${opponent.name} wins.`}</div>}

      <section className="player-zone opponent-zone">
        <div className="mana-row-wrapper">
          <ManaRow player={opponent} />
        </div>
        <div className="life-row">
          <span className="life-total">
            {opponent.name}: {opponent.life} life
          </span>
          <div className="life-buttons">
            {LIFE_STEPS.map((delta) => (
              <button key={delta} className="life-step-button" onClick={() => adjustLife(opponent.id, delta)}>
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
            {soloControl && (
              <button className="draw-button" onClick={() => onAction({ type: 'DRAW_CARD' }, opponent.id)}>
                Draw
              </button>
            )}
          </div>
        </div>
        <div className="hand-row opponent-hand">
          {opponent.zones.hand.map((c) => (
            <Card key={c.instanceId} definition={getCardDefinition(c.defId)} faceDown />
          ))}
        </div>
        {renderBattlefield(opponent, true)}
        {renderZoneCounts(opponent)}
      </section>

      <section className="middle-zone">
        <div className="log-view">
          {recentLog.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))}
        </div>
      </section>

      <section className="player-zone your-zone">
        {renderZoneCounts(you)}
        {renderBattlefield(you, false)}

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

        <div className="hand-row your-hand">
          {you.zones.hand.map((c) => (
            <Card key={c.instanceId} definition={getCardDefinition(c.defId)} instance={c} onClick={() => setOpenPanelId(c.instanceId)} />
          ))}
        </div>
        <div className="mana-row-wrapper">
          <ManaRow player={you} />
        </div>
        <div className="life-row">
          <span className="life-total">
            {you.name}: {you.life} life
          </span>
          <div className="life-buttons">
            {LIFE_STEPS.map((delta) => (
              <button key={delta} className="life-step-button" onClick={() => adjustLife(you.id, delta)}>
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
            <button className="draw-button" onClick={() => onAction({ type: 'DRAW_CARD' }, you.id)}>
              Draw
            </button>
          </div>
        </div>
      </section>

      <div className="bottom-left-controls">
        <button className="undo-button" onClick={() => onAction({ type: 'UNDO' })} title="Step back through recent actions">
          {'\u21b6'} Undo
        </button>
        <button className="concede-button" onClick={() => onAction({ type: 'CONCEDE' }, yourPlayerId)}>
          Concede
        </button>
      </div>

      {openCard && (
        <CardActionsPanel
          definition={getCardDefinition(openCard.card.defId)}
          instance={openCard.card}
          currentZone={openCard.zone}
          onToggleTap={() => handleToggleTap(openCard.card)}
          onFlip={() => onAction({ type: 'FLIP_CARD', instanceId: openCard.card.instanceId })}
          onCast={() => handleCast(openCard.card)}
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
    </div>
  );
}