// ─── SafeImage ────────────────────────────────────────────────────────────────
// Renders an image with a fallback when the URL is blocked (CORS, forbidden, etc.)
// Use for user-provided URLs (profile photos, post images) that may be blocked.

import React, { useState } from 'react';
import { t } from '../../strings.js';

/**
 * @param {{
 *   src:        string,
 *   alt?:       string,
 *   className?: string,
 *   fallback?:  React.ReactNode,  – custom fallback when image fails
 *   fallbackClass?: string,       – class for default fallback div
 * }} props
 */
export default function SafeImage({ src, alt = '', className = '', fallback, fallbackClass = '' }) {
  const [errored, setErrored] = useState(false);

  if (!src) return null;
  if (errored) {
    if (fallback) return fallback;
    return (
      <div
        className={`flex items-center justify-center bg-slate-700 text-slate-500 text-xs text-center ${fallbackClass}`}
        title={t('image_url_blocked')}
      >
        <span className="px-2 py-1">{t('image_url_blocked')}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
    />
  );
}
