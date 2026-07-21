import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { t } from '../i18n/translations'

const SettingsContext = createContext(null)

const THEME_KEY = 'tubetale-theme'
const LANG_KEY = 'tubetale-lang'

function applyThemeToDocument(theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.toggle('dark', theme === 'night')
}

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'day' || saved === 'night') return saved
    // Migrate legacy key if present
    const legacy = localStorage.getItem('insight-observer-theme')
    return legacy === 'day' ? 'day' : 'night'
  })
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'th' || saved === 'en') return saved
    const legacy = localStorage.getItem('insight-observer-lang')
    return legacy === 'th' ? 'th' : 'en'
  })

  useEffect(() => {
    applyThemeToDocument(theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang === 'th' ? 'th' : 'en')
    localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  const value = useMemo(
    () => ({
      theme,
      lang,
      setTheme,
      setLang,
      toggleTheme: () => setTheme((prev) => (prev === 'day' ? 'night' : 'day')),
      tr: (key, vars) => t(lang, key, vars),
    }),
    [theme, lang],
  )

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return ctx
}
