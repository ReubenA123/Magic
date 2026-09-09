import React, { useState } from 'react';
import { CARD_POOL } from '../data/cards';
import { AccountAvatar } from '../api/accountTypes';
import { cropImageStyle, NaturalSize } from '../utils/avatarCrop';

interface AvatarProps {
  avatar: AccountAvatar | null | undefined;
  size?: number;
}

/**
 * Renders the same crop everywhere it shows up (NavBar, account page, the
 * cropper's own live preview) from just the three stored numbers - see
 * server/src/routes/auth.ts's avatar route for why only a reference is
 * stored rather than a rendered image, and utils/avatarCrop.ts for the
 * actual sizing/positioning math this shares with AvatarCropper. Looks up
 * CARD_POOL directly (not getCardDefinition, which throws on a miss) since
 * a stale/removed card id should fall back quietly, not crash whatever
 * page happens to render this avatar.
 */
export default function Avatar({ avatar, size = 36 }: AvatarProps) {
  const def = avatar ? CARD_POOL.find((c) => c.id === avatar.cardId) : null;
  const [natural, setNatural] = useState<NaturalSize | null>(null);

  return (
    <div className="avatar-circle" style={{ width: size, height: size }}>
      {def && avatar ? (
        <img
          src={def.imagePath}
          alt=""
          className="avatar-circle-image"
          onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
          style={cropImageStyle(natural, size, avatar)}
        />
      ) : (
        <div className="avatar-circle-placeholder">{'\u{1F464}'}</div>
      )}
    </div>
  );
}
