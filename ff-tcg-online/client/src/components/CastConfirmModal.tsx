import React from 'react';
import { CardDefinition } from '../types';

interface CastConfirmModalProps {
  definition: CardDefinition;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Action verbs worth calling out before you commit - "what's about to
 * happen" (mill, sacrifice, create a token, exile, ...). Deliberately
 * excludes static/keyword abilities like indestructible or flash - those
 * describe how the permanent behaves once it's already in play, not an
 * effect this cast is about to trigger.
 */
const ACTION_KEYWORDS = [
  'mill',
  'sacrifice',
  'create',
  'token',
  'exile',
  'destroy',
  'draw',
  'discard',
  'surveil',
  'scry',
  'return',
  'search',
  'reveal',
  'transform',
  'meld',
  'tap',
  'untap',
  'fight',
  'counter',
];
const ACTION_KEYWORD_PATTERN = new RegExp(`\\b(${ACTION_KEYWORDS.join('|')})\\b`, 'gi');
const ACTION_KEYWORD_SET = new Set(ACTION_KEYWORDS);

function renderTextWithActionHighlights(text: string): React.ReactNode {
  return text.split(ACTION_KEYWORD_PATTERN).map((part, i) =>
    ACTION_KEYWORD_SET.has(part.toLowerCase()) ? (
      <mark key={i} className="cast-confirm-keyword">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

/**
 * Shown whenever a card is dragged from hand (or the command zone) onto the
 * battlefield to cast it - dragging is easy to do by accident, so this makes
 * the actual cast a deliberate, separate confirmation instead of firing the
 * instant the card is dropped. No backdrop-click dismissal - Cancel is the
 * only way out, so the choice is always explicit.
 */
export default function CastConfirmModal({ definition, onConfirm, onCancel }: CastConfirmModalProps) {
  return (
    <div className="card-drawer-overlay">
      <div className="card-preview-panel">
        <img src={definition.imagePath} alt={definition.name} className="card-preview-image" />
      </div>

      <div className="card-actions-panel">
        <div className="card-actions-header">
          <strong>{definition.name}</strong>
        </div>

        <p className="card-actions-text">{renderTextWithActionHighlights(definition.text)}</p>

        <div className="card-actions-spacer" />

        <div className="card-actions-bottom-row">
          <button className="card-action-button card-action-button-play" onClick={onConfirm}>
            Cast
          </button>
          <button className="card-action-button card-action-button-cancel-x" onClick={onCancel} aria-label="Cancel" title="Cancel">
            {'✕'}
          </button>
        </div>
      </div>
    </div>
  );
}
