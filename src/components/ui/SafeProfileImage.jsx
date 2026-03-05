// ─── SafeProfileImage ─────────────────────────────────────────────────────────
// Renders an img for profile/cover photos. On load error (CORS, CORP, 404)
// falls back to children. Use for URLs that may be blocked (e.g. Instagram CDN).

import React, { useState } from 'react';

/**
 * @param {{ src: string, fallback: React.ReactNode, className?: string, alt?: string, ...rest }} props
 */
export default function SafeProfileImage({ src, fallback, className = '', alt = '', ...rest }) {
  const [error, setError] = useState(false);
  if (!src || error) return fallback;
  return (
    <img
      src={src}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      className={className}
      alt={alt}
      {...rest}
    />
  );
}
