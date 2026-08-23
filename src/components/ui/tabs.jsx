import * as React from 'react'
import { cn } from '@/lib/utils'

const TabsContext = React.createContext(null)

const Tabs = ({ defaultValue, value, onValueChange, children, className }) => {
  const [internalActive, setInternalActive] = React.useState(value ?? defaultValue)
  const active = value !== undefined ? value : internalActive
  const setActive = React.useCallback(
    (v) => {
      if (value === undefined) setInternalActive(v)
      onValueChange?.(v)
    },
    [value, onValueChange]
  )
  const ctx = React.useMemo(() => ({ active, setActive }), [active, setActive])
  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn('', className)} data-tabs>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const TabsList = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground', className)}
    {...props}
  >
    {children}
  </div>
))
TabsList.displayName = 'TabsList'

const TabsTrigger = React.forwardRef(({ className, value, children, ...props }, ref) => {
  const ctx = React.useContext(TabsContext)
  const active = ctx?.active === value
  return (
    <button type="button"
      ref={ref}
      data-state={active ? 'active' : 'inactive'}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className
      )}
      onClick={() => ctx?.setActive(value)}
      {...props}
    >
      {children}
    </button>
  )
})
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = React.forwardRef(({ className, value, children, ...props }, ref) => {
  const ctx = React.useContext(TabsContext)
  if (ctx?.active !== value) return null
  return (
    <div
      ref={ref}
      className={cn('mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      {...props}
    >
      {children}
    </div>
  )
})
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
