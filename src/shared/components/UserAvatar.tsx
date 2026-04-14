import { useEffect, useState, type CSSProperties } from 'react';
import { getImageUrl } from '@/shared/utils/helpers';

type UserAvatarProps = {
  name?: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
  iconSize?: number;
  fallbackMode?: 'icon' | 'initial';
};

export default function UserAvatar({
  name = '',
  imageUrl,
  size = 48,
  className,
  style,
  iconSize,
  fallbackMode = 'icon',
}: UserAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl]);

  const resolvedImage = imageUrl && !hasImageError
    ? (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:') ? imageUrl : getImageUrl(imageUrl, ''))
    : '';
  const fallbackIconSize = iconSize ?? Math.max(20, Math.round(size * 0.52));
  const fallbackTextSize = iconSize ?? Math.max(14, Math.round(size * 0.44));
  const avatarStyle = {
    '--user-avatar-size': `${size}px`,
    '--user-avatar-icon-size': `${fallbackIconSize}px`,
    ...style,
  } as CSSProperties;

  return (
    <div
      className={['s-useravatar-615f53', className].filter(Boolean).join(' ')}
      style={avatarStyle}
      aria-label={name ? `${name} profile image` : 'User profile image'}
    >
      {resolvedImage ? (
        <img
          src={resolvedImage}
          alt={name || 'User'}
          className="s-useravatar-a31f6f"
          onError={() => setHasImageError(true)}
        />
      ) : fallbackMode === 'initial' ? (
        <span
          className="s-useravatar-initial"
          style={{ fontSize: `${fallbackTextSize}px` }}
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      ) : (
        <i className="bi bi-person-circle s-useravatar-25a4f1" />
      )}
    </div>
  );
}
