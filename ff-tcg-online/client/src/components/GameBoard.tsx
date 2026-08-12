import React, { useMemo, useState } from 'react';
import { CardInstance, GameState, PlayerState, ZoneName } from '../types';
import { getCardDefinition } from '../data/cards';
import { sendAction } from '../api/socket';
import Card from './Card';
import PhaseBar from './PhaseBar';
import CardActionsPanel from './CardActionsPanel';
import ZoneModal from './ZoneModal';

interface GameBoardProps {
  state: GameState;
  yourPlayerId: string;
  actionError: string | null;
}

const LIFE_STEPS = [-5, -1, 1, 5];

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

export default function GameBoard({ state, yourPlayerId, actionError }: GameBoardProps) {
  const you = state.players.find((p) => p.id === yourPlayerId)!;
  const opponent = state.players.find((p) => p.id !== yourPlayerId)!;
  const isYourTurn = state.activePlayerId === yourPlayerId;

  const [openPanelId, setOpenPanelId] = useState<string | null>(null);
  const [openZone, setOpenZone] = useState<{ playerId: string; zone: 'graveyard' | 'exile' } | null>(null);

  const recentLog = useMemo(() => state.log.slice(-10), [state.log]);
  const openCard = openPanelId ? findCard(state, openPanelId) : null;

  function adjustLife(playerId: string, delta: number) {
    sendAction({ type: 'ADJUST_LIFE', playerId, delta });
  }

  function renderBattlefield(player: PlayerState) {
    return (
      <div className="battlefield-row">
        {player.zones.battlefield.map((c) => (
          <Card key={c.instanceId} definition={getCardDefinition(c.defId)} instance={c} onClick={() => setOpenPanelId(c.instanceId)} />
        ))}
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
        onNextPhase={() => sendAction({ type: 'NEXT_PHASE' })}
        onEndTurn={() => sendAction({ type: 'END_TURN' })}
      />

      {actionError && <div className="action-error-banner">{actionError}</div>}
      {state.winnerId && <div className="winner-banner">{state.winnerId === yourPlayerId ? 'You win!' : `${opponent.name} wins.`}</div>}

      {/* --- Opponent's side ------------------------------------------------ */}
      <section className="player-zone opponent-zone">
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
          </div>
        </div>
        <div className="hand-row opponent-hand">
          {opponent.zones.hand.map((c) => (
            <Card key={c.instanceId} definition={getCardDefinition(c.defId)} faceDown />
          ))}
        </div>
        {renderBattlefield(opponent)}
        {renderZoneCounts(opponent)}
      </section>

      {/* --- Log --------------------------------------------------------------- */}
      <section className="middle-zone">
        <div className="log-view">
          {recentLog.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))}
        </div>
      </section>

      {/* --- Your side -------------------------------------------------------- */}
      <section className="player-zone your-zone">
        {renderZoneCounts(you)}
        {renderBattlefield(you)}
        <div className="hand-row your-hand">
          {you.zones.hand.map((c) => (
            <Card key={c.instanceId} definition={getCardDefinition(c.defId)} instance={c} onClick={() => setOpenPanelId(c.instanceId)} />
          ))}
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
          </div>
        </div>
      </section>

      <div className="bottom-left-controls">
        <button className="undo-button" onClick={() => sendAction({ type: 'UNDO' })} title="Step back through recent actions">
          {'\u21b6'} Undo
        </button>
        <button className="concede-button" onClick={() => sendAction({ type: 'CONCEDE' })}>
          Concede
        </button>
      </div>

      {openCard && (
        <CardActionsPanel
          definition={getCardDefinition(openCard.card.defId)}
          instance={openCard.card}
          currentZone={openCard.zone}
          onToggleTap={() => sendAction({ type: 'TOGGLE_TAP', instanceId: openCard.card.instanceId })}
          onMove={(toZone) => {
            sendAction({ type: 'MOVE_CARD', instanceId: openCard.card.instanceId, toZone });
            setOpenPanelId(null);
          }}
          onAdjustCounter={(label, delta) => sendAction({ type: 'ADJUST_COUNTER', instanceId: openCard.card.instanceId, label, delta })}
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
