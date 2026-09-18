import React, { useEffect, useState } from 'react';

interface CoinFlipResult {
  id: string;
  called: 'heads' | 'tails';
  result: 'heads' | 'tails';
  won: boolean;
}

interface CoinFlipModalProps {
  sourceName: string;
  controllerName: string;
  /** True if the viewer is the one who has to call the flip (its
   * controller, or soloControl) - everyone else just watches. */
  canChoose: boolean;
  /** 'choosing': GameState.pendingCoinFlip is outstanding, nothing flipped
   * yet. 'revealing': the flip already happened (CHOOSE_COIN_SIDE resolved
   * in the same step) - `result` is GameState.lastCoinFlip, shown here as an
   * animated reveal even though the actual game-state change (e.g. the
   * Treasure token) already exists by the time this renders. */
  phase: 'choosing' | 'revealing';
  result: CoinFlipResult | null;
  onChoose: (side: 'heads' | 'tails') => void;
  onDismiss: () => void;
}

/**
 * Shown for a CoinFlipEffect (The Gold Saucer's "Flip a coin. If you win the
 * flip, ...") - both players see it (a coin flip is public), but only the
 * controller gets Heads/Tails buttons. Once called, the coin has already
 * landed server/engine-side (no separate reveal step in the action model) -
 * this just plays a real coin-spin animation ending on the actual result
 * before showing win/lose, purely for presentation. `result.id` is a fresh
 * value every flip (see engine/actions.ts: chooseCoinSide) so re-keying the
 * spinning coin element on it restarts the CSS animation for each new flip.
 */
export default function CoinFlipModal({ sourceName, controllerName, canChoose, phase, result, onChoose, onDismiss }: CoinFlipModalProps) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (phase !== 'revealing' || !result) return;
    setSettled(false);
    const timer = setTimeout(() => setSettled(true), 1300);
    return () => clearTimeout(timer);
  }, [phase, result?.id]);

  // Land on a full spin for heads (front face at rest) or a full spin plus a
  // half-turn for tails (back face at rest, per the backface-visibility flip
  // trick in styles.css) - several extra full turns first just so it visibly
  // spins rather than snapping straight to its resting angle.
  const finalRotation = result ? (result.result === 'heads' ? 1800 : 1980) : 0;

  return (
    <div className="card-actions-overlay">
      <div className="zone-modal coin-flip-modal">
        <div className="card-actions-header">
          <strong>{sourceName} — Coin Flip</strong>
        </div>

        {phase === 'choosing' ? (
          canChoose ? (
            <>
              <p className="card-actions-text">Call it — heads or tails?</p>
              <div className="card-actions-bottom-row">
                <button className="card-action-button card-action-button-play" onClick={() => onChoose('heads')}>
                  Heads
                </button>
                <button className="card-action-button card-action-button-play" onClick={() => onChoose('tails')}>
                  Tails
                </button>
              </div>
            </>
          ) : (
            <p className="card-actions-text">Waiting for {controllerName} to call heads or tails…</p>
          )
        ) : (
          result && (
            <>
              <div className="coin-flip-stage">
                <div key={result.id} className="coin-flip-coin" style={{ '--coin-final-rotation': `${finalRotation}deg` } as React.CSSProperties}>
                  <div className="coin-face coin-face-heads">H</div>
                  <div className="coin-face coin-face-tails">T</div>
                </div>
              </div>
              {settled && (
                <>
                  <p className="card-actions-text">
                    {controllerName} called {result.called}. The coin lands on {result.result} — {result.won ? 'a win!' : 'a loss.'}
                  </p>
                  <div className="card-actions-bottom-row">
                    <button className="card-action-button secondary" onClick={onDismiss}>
                      Close
                    </button>
                  </div>
                </>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
