// ─── MemberAvatar ─────────────────────────────────────────────────────────────
// Renders a member's profile photo (or initial letter fallback) alongside their
// display name.  When `onViewProfile` is provided the whole element becomes a
// clickable button that opens the profile modal.
// Uses SafeProfileImage so external URLs (e.g. Google) load correctly when
// served from localhost (referrerPolicy) and fall back on load error.

import React from 'react';
import { ensureString } from '../../utils.js';
import SafeProfileImage from './SafeProfileImage.jsx';

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

  const initialFallback = (
    <div className={`${sizeClass} rounded-full bg-slate-600 shrink-0 flex items-center justify-center font-bold text-white`}>
      {(ensureString(membership?.displayName) || '?')[0].toUpperCase()}
    </div>
  );

  const avatar = membership?.photoURL ? (
    <SafeProfileImage
      src={membership.photoURL}
      fallback={initialFallback}
      className={`${sizeClass} rounded-full shrink-0 object-cover object-[center_top]`}
      alt=""
    />
  ) : (
    initialFallback
  );

  if (!onViewProfile) {
    return (
      <div className="flex items-center gap-2">
        {avatar}
        <span>{ensureString(membership?.displayName)}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => onViewProfile(membership)}
      className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
    >
      {avatar}
      <span className="hover:underline font-medium">{ensureString(membership?.displayName)}</span>
    </button>
  );
}
