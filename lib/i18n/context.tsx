"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { translations, type Locale, type TranslationKey } from "./translations"

const STORAGE_KEY = "bonair.locale"
const DEFAULT_LOCALE: Locale = "tr"

interface LanguageContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: TranslationKey
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: translations[DEFAULT_LOCALE],
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  // localStorage'dan oku (hydration sonrası)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "tr" || stored === "en") {
        setLocaleState(stored)
      }
    } catch {
      /* sessiz */
    }
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* sessiz */
    }
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </LanguageContext.Provider>
  )
}

/** Bileşenlerde kullan: `const { t, locale, setLocale } = useLanguage()` */
export function useLanguage() {
  return useContext(LanguageContext)
}
