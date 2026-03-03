import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const LOCAL_STORAGE_KEY = 'theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeClass(theme: Theme) {
  if (typeof window === 'undefined') return

  const root = document.documentElement
  const resolved = theme === 'system' ? getSystemTheme() : theme

  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'

    const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved
    }

    return 'system'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    applyThemeClass(theme)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyThemeClass('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return

    localStorage.setItem(LOCAL_STORAGE_KEY, theme)
    applyThemeClass(theme)
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const toggleTheme = () => {
    setThemeState((current) => {
      if (current === 'light') return 'dark'
      if (current === 'dark') return 'system'
      return 'light'
    })
  }

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  }
}
