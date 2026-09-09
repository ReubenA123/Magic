import React, { useEffect, useRef, useState } from 'react';
import { CARD_POOL } from '../data/cards';
import { setAvatar } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/rest';
import { coverSize, cropImageStyle, NaturalSize } from '../utils/avatarCrop';
import Card from './Card';

interface AvatarCropperProps {
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const PREVIEW_SIZE = 220;

/**
 * Two steps in one modal: pick any card, then pan/zoom its art into the
 * circle. Nothing here renders a cropped image file - it only ever works
 * out (cardId, x, y, zoom) and hands that to the server (see api/auth.ts's
 * setAvatar); Avatar.tsx re-renders that same crop live everywhere the
 * picture actually shows, using the exact same sizing/positioning math
 * (see utils/avatarCrop.ts) - so what you see while dragging here is
 * pixel-for-pixel what gets saved, not an approximation of it.
 */
export default function AvatarCropper({ onClose }: AvatarCropperProps) {
  const { user, setUser } = useAuth();
  const [query, setQuery] = useState('');
  // Re-opening the editor on an already-set avatar jumps straight to
  // cropping that same card, picking up its saved position instead of
  // making you find and re-pick it from scratch.
  const [cardId, setCardId] = useState<string | null>(user?.avatar?.cardId ?? null);
  const [x, setX] = useState(user?.avatar?.x ?? 0.5);
  const [y, setY] = useState(user?.avatar?.y ?? 0.5);
  const [zoom, setZoom] = useState(user?.avatar?.zoom ?? 1);
  const [natural, setNatural] = useState<NaturalSize | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whichever drag's own window listeners are currently attached, if any -
  // only ever used to detach them again (on mouseup, or on unmount if the
  // modal closes mid-drag), never read otherwise.
  const endActiveDragRef = useRef<(() => void) | null>(null);

  useEffect(() => () => endActiveDragRef.current?.(), []);

  const results = query.trim() ? CARD_POOL.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 40) : [];
  const selectedCard = cardId ? CARD_POOL.find((c) => c.id === cardId) : null;

  function pickCard(id: string) {
    setCardId(id);
    setX(0.5);
    setY(0.5);
    setZoom(1);
    setNatural(null); // a fresh image is loading - forget the old one's dimensions
  }

  /**
   * Tracked on window, not on the preview element itself - the preview is
   * only 220px across, so any real mouse drag routinely moves the cursor
   * outside it in a single tick. Scoping the listeners to the element (via
   * onMouseMove/onMouseLeave) meant the drag ended the instant that
   * happened, which was the earlier "dragging doesn't work" bug. Window-level
   * listeners keep tracking wherever the cursor goes, and only stop on an
   * actual mouseup.
   *
   * The delta-to-fraction conversion uses the image's own *rendered* size
   * (coverSize, same math the display uses - see utils/avatarCrop.ts), not
   * the container size: card art is portrait, so at cover-fit its width
   * already exactly fills a square container with zero horizontal slack -
   * dividing by the container size there would make horizontal dragging a
   * no-op again, same as the original object-position bug.
   */
  function startDrag(e: React.MouseEvent) {
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = x;
    const startY = y;
    const { width: renderedWidth, height: renderedHeight } = coverSize(natural, PREVIEW_SIZE, zoom);

    function handleMove(ev: MouseEvent) {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      // Dragging the art itself (not a viewfinder) - moving it right brings
      // the art's left side into view, so the focal point moves toward a
      // smaller x%.
      const nextX = startX - dx / renderedWidth;
      const nextY = startY - dy / renderedHeight;
      setX(Math.min(1, Math.max(0, nextX)));
      setY(Math.min(1, Math.max(0, nextY)));
    }

    function handleUp() {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      endActiveDragRef.current = null;
    }

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    endActiveDragRef.current = handleUp;
  }

  async function handleSave() {
    if (!cardId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await setAvatar(cardId, x, y, zoom);
      setUser(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile picture - try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-actions-overlay" onClick={onClose}>
      <div className="avatar-cropper-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>Edit Profile Picture</strong>
          <button className="close-button" onClick={onClose}>
            {'✕'}
          </button>
        </div>

        {!selectedCard ? (
          <>
            <input className="library-search" placeholder="Search for a card…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            <div className="avatar-cropper-pick-grid">
              {results.map((c) => (
                <button key={c.id} className="avatar-cropper-pick-item" onClick={() => pickCard(c.id)} title={c.name}>
                  <Card definition={c} />
                </button>
              ))}
              {query.trim() && results.length === 0 && <p className="account-tab-hint">No cards match "{query}".</p>}
            </div>
          </>
        ) : (
          <>
            <div className="avatar-cropper-preview" style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }} onMouseDown={startDrag}>
              <img
                src={selectedCard.imagePath}
                alt=""
                draggable={false}
                onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
                style={cropImageStyle(natural, PREVIEW_SIZE, { x, y, zoom })}
              />
            </div>
            <p className="account-tab-hint">Drag the image to reposition it.</p>

            <label htmlFor="avatar-zoom">Zoom</label>
            <input
              id="avatar-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />

            {error && <p className="account-tab-error">{error}</p>}

            <div className="avatar-cropper-buttons">
              <button className="card-action-button secondary" onClick={() => setCardId(null)}>
                Choose a different card
              </button>
              <button className="card-action-button card-action-button-play" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
