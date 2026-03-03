// ─── MemberAvatar ─────────────────────────────────────────────────────────────
// Renders a member's profile photo (or initial letter fallback) alongside their
// display name.  When `onViewProfile` is provided the whole element becomes a
// clickable button that opens the profile modal.

import React from 'react';

/**
 * @param {{
 *   membership:    object,        – membership document
 *   size:          'sm'|'md'|'lg',– avatar dimension preset
 *   onViewProfile: function|null,  – optional click handler
 * }} props
 */
export default function MemberAvatar({ membership, size = 'sm', onViewProfile }) {
  const sizeClass =
    size === 'sm' ? 'w-6 h-6 text-[10px]' :
    size === 'md' ? 'w-9 h-9 text-sm'     :
                   'w-14 h-14 text-xl';

  const avatar = membership?.photoURL ? (
    <img
      src={membership.photoURL}
      className={`${sizeClass} rounded-full shrink-0 object-cover`}
      alt=""
    />
  ) : (
    <div className={`${sizeClass} rounded-full bg-slate-600 shrink-0 flex items-center justify-center font-bold text-white`}>
      {(membership?.displayName || '?')[0].toUpperCase()}
    </div>
  );

  if (!onViewProfile) {
    return (
      <div className="flex items-center gap-2">
        {avatar}
        <span>{membership?.displayName}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => onViewProfile(membership)}
      className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
    >
      {avatar}
      <span className="hover:underline font-medium">{membership?.displayName}</span>
    </button>
  );
}
