// ============================================================================
// utils/avatarCrop.ts
//
// Shared by Avatar.tsx (display) and AvatarCropper.tsx (editing) - both need
// to size and position the same card image inside a square box identically,
// so the crop you drag into place is exactly the crop that shows everywhere else.
//
// This does the classic object-fit:cover math by hand instead of leaning on
// the CSS property of the same name, because object-position has no effect
// on whichever axis has zero overflow - and every card image is portrait
// (taller than wide), so fit into a square box its width has zero
// horizontal slack for object-position to move through, at any zoom. That
// was the original "dragging left/right doesn't work" bug. Doing the sizing
// ourselves and positioning with a percentage transform (which is always
// relative to the element's own rendered size, not the leftover slack)
// guarantees both directions always have somewhere real to go.
// ============================================================================

import type { CSSProperties } from 'react';

export interface CropPosition {
  x: number;
  y: number;
  zoom: number;
}

export interface NaturalSize {
  width: number;
  height: number;
}

/** The image's own rendered size at this zoom - `zoom` 1 means exactly
 * covering the container (the tighter dimension fits exactly, the other
 * overflows); anything above that enlarges further, so there's always
 * overflow in both directions for dragging to move through. Falls back to
 * a plain square before the image has loaded and reported its real
 * dimensions (see onLoad in the two callers). */
export function coverSize(natural: NaturalSize | null, containerSize: number, zoom: number): { width: number; height: number } {
  if (!natural || natural.width <= 0 || natural.height <= 0) {
    return { width: containerSize, height: containerSize };
  }
  const scale = Math.max(containerSize / natural.width, containerSize / natural.height) * zoom;
  return { width: natural.width * scale, height: natural.height * scale };
}

/** x/y (0-1) name which point of the image's own rendered box ends up at
 * the container's center - `left/top: 50%` plus a percentage transform
 * (always relative to the element's own size, unlike object-position)
 * places exactly that point there, regardless of the image's aspect ratio. */
export function cropImageStyle(natural: NaturalSize | null, containerSize: number, crop: CropPosition): CSSProperties {
  const { width, height } = coverSize(natural, containerSize, crop.zoom);
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width,
    height,
    transform: `translate(-${crop.x * 100}%, -${crop.y * 100}%)`,
  };
}
