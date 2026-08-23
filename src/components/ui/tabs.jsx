import * as React from 'react'
import { cn } from '@/lib/utils'

const Tabs = ({ defaultValue, value, onValueChange, children, className }) => {
  const [internalActive, setInternalActive] = React.useState(value ?? defaultValue)
  const active = value !== undefined ? value : internalActive
  const setActive = (v) => {
    if (value === undefined) setInternalActive(v)
    onValueChange?.(v)
  }
  const ctx = { active, setActive }
  return <div className={cn('', className)} data-tabs>{React.Children.map(children, (c) => React.isValidElement(c) ? React.cloneElement(c, { _ctx: ctx }) : c)}</div>
}

const TabsList = React.forwardRef(({ className, children, _ctx, ...props }, ref) => (
  <div ref={ref} className={cn('inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground', className)} {...props}>
    {React.Children.map(children, (c) => React.isValidElement(c) ? React.cloneElement(c, { _ctx }) : c)}
  </div>
))
TabsList.displayName = 'TabsList'

const TabsTrigger = React.forwardRef(({ className, value, children, _ctx, ...props }, ref) => {
  const active = _ctx?.active === value
  return (
    <button
      ref={ref}
      data-state={active ? 'active' : 'inactive'}
      className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm', className)}
      onClick={() => _ctx?.setActive(value)}
      {...props}
    >
      {children}
    </button>
  )
})
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = React.forwardRef(({ className, value, children, _ctx, ...props }, ref) => {
  if (_ctx?.active !== value) return null
  return <div ref={ref} className={cn('mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...props}>{children}</div>
})
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
