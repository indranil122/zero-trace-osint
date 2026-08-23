import * as React from 'react'

const STORAGE_KEY = 'zt-theme'

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {}
  return null
}

const ThemeContext = React.createContext({ theme: 'light', setTheme: () => {}, toggle: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setThemeRaw] = React.useState(() => getStoredTheme() || getSystemTheme())

  const setTheme = React.useCallback((next) => {
    setThemeRaw(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }, [])

  const toggle = React.useCallback(() => {
    setThemeRaw((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }, [])

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    root.setAttribute('data-theme', theme)
    // Sync Tailwind dark: variant class
    root.style.colorScheme = theme
  }, [theme])

  // follow system if no stored pref, live update
  React.useEffect(() => {
    if (getStoredTheme()) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setThemeRaw(e.matches ? 'dark' : 'light')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const value = React.useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
