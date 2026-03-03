// ─── LANGUAGE CONTEXT ─────────────────────────────────────────────────────────
// Provides the current language, the t() translation helper, and a setter.
// Import LangContext anywhere with:
//   import LangContext from '../i18n/LangContext';
//   const { t } = React.useContext(LangContext);

import React from 'react';
import TRANSLATIONS from './translations.js';

/**
 * React context that carries:
 *  - lang      : current language code ('en' | 'es')
 *  - t(key)    : returns the translated string for `key`
 *  - setLang   : call to switch the active language
 */
const LangContext = React.createContext({
  lang:    'es',
  t:       (k) => k,
  setLang: () => {},
});

export default LangContext;
export { TRANSLATIONS };
