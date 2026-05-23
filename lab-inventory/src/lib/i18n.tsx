import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { translations, type TranslationKey } from './translations'

export type Lang = 'fr' | 'en'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}

const LangContext = createContext<LangCtx>({
  lang: 'fr',
  setLang: () => {},
  t: (k) => k,
})

function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem('lang')
    if (stored === 'en' || stored === 'fr') return stored
  } catch {}
  return 'fr'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('lang', l) } catch {}
  }, [])

  const t = useCallback(
    (key: TranslationKey): string => translations[lang][key] ?? translations.fr[key] ?? key,
    [lang],
  )

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang() { return useContext(LangContext) }
