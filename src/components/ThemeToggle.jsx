import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      aria-pressed={isDark}
      onClick={toggle}
      className={`group relative inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white text-zinc-700 shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md active:translate-y-0 active:scale-[0.97] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 ${className}`}
    >
      <span className="relative h-4 w-4 overflow-hidden">
        <Sun
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${isDark ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}`}
        />
        <Moon
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${isDark ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}
        />
      </span>
    </button>
  )
}
