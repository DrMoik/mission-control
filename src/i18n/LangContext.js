// ─── LANGUAGE CONTEXT ─────────────────────────────────────────────────────────
// Provides the current language and the t() translation helper.
// Spanish only for now; bilingual toggle commented out — will deal with that later.
// Import LangContext anywhere with:
//   import LangContext from '../i18n/LangContext';
//   const { t } = React.useContext(LangContext);

import React from 'react';
import TRANSLATIONS from './translations.js';

/**
 * React context that carries:
 *  - lang      : 'es' (Spanish only for now)
 *  - t(key)    : returns the translated string for `key`
 *  - setLang   : no-op (bilingual support deferred)
 */
const LangContext = React.createContext({
  lang:    'es',
  t:       (k) => k,
  setLang: () => {},
});

export default LangContext;
export { TRANSLATIONS };
