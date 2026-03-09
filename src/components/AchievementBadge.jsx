// ─── AchievementBadge ───────────────────────────────────────────────────────
// Collectible badge component: frame + icon + tier + label.
// Uses Game-Icons SVGs; supports locked/unlocked states, hover feedback, and custom color.

import React from 'react';
import { resolveAchievementIcon, resolveIconFilter } from '../config/achievementIcons.js';
import { getTierStyles } from '../config/achievementTiers.js';

/**
 * @param {{
 *   icon: string,
 *   color?: string,
 *   title?: string,
 *   tier?: string,
 *   unlocked?: boolean,
 *   size?: 'sm' | 'md' | 'lg',
 *   description?: string,
 *   compact?: boolean,
 *   className?: string,
 * }} props
 */
export default function AchievementBadge({
  icon,
  color,
  title,
  tier = '',
  unlocked = true,
  size = 'md',
  description,
  compact = false,
  className = '',
}) {
  const resolved = resolveAchievementIcon(icon);
  const iconFilter = resolveIconFilter(color);
  const styles = getTierStyles(tier);

  const sizeMap = {
    sm: { badge: 'w-10 h-10', icon: 'w-5 h-5' },
    md: { badge: 'w-14 h-14', icon: 'w-7 h-7' },
    lg: { badge: 'w-20 h-20', icon: 'w-10 h-10' },
  };
  const s = sizeMap[size] || sizeMap.md;

  const isCustomImage = resolved?.type === 'url';
  const iconSrc = resolved?.path;

  const iconEl = iconSrc ? (
    isCustomImage ? (
      <img
        src={iconSrc}
        alt=""
        className={`${s.icon} object-contain rounded-full`}
      />
    ) : iconFilter ? (
      <img
        src={iconSrc}
        alt=""
        className={`${s.icon} object-contain ${!unlocked ? 'opacity-70' : ''}`}
        style={{ filter: iconFilter }}
      />
    ) : (
      <img
        src={iconSrc}
        alt=""
        className={`${s.icon} object-contain [filter:brightness(0)_invert(1)] ${!unlocked ? 'opacity-70' : ''}`}
      />
    )
  ) : (
    <span className="text-lg opacity-50">?</span>
  );

  return (
    <div
      className={`
        flex flex-col items-center gap-1.5
        transition-all duration-200 ease-out
        ${unlocked ? 'hover:-translate-y-0.5 hover:scale-[1.02]' : ''}
        ${className}
      `.trim()}
    >
      {/* Badge container — circular medal frame */}
      <div
        className={`
          ${s.badge} rounded-full flex items-center justify-center
          bg-gradient-to-br ${styles.frame}
          ring-2 ${styles.ring}
          ${unlocked ? `shadow-lg ${styles.glow}` : 'opacity-60 grayscale'}
          transition-all duration-200
        `.trim()}
      >
        {iconEl}
      </div>
      {/* Label — hidden in compact mode */}
      {!compact && (title || description) && (
        <div className="text-center min-w-0 max-w-full">
          {title && (
            <div className={`text-xs font-semibold truncate ${unlocked ? 'text-content-primary' : 'text-content-tertiary'}`}>
              {title}
            </div>
          )}
          {description && (
            <div className="text-[10px] text-content-tertiary line-clamp-1 mt-0.5">
              {description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
