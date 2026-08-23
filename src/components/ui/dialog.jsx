import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

const DialogContext = React.createContext(null)

const Dialog = ({ open, onOpenChange, children }) => {
  const ctx = React.useMemo(() => ({ onOpenChange }), [onOpenChange])
  if (!open) return null
  return <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>
}

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext) || {}
  return <div ref={ref} className={cn('fixed inset-0 z-50 bg-black/40 backdrop-blur-sm', className)} onClick={() => onOpenChange?.(false)} {...props} />
})
DialogOverlay.displayName = 'DialogOverlay'

const DialogContent = React.forwardRef(({ className, children, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext) || {}
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={ariaLabelledby ? undefined : (ariaLabel || 'Dialog')} aria-labelledby={ariaLabelledby} className={cn('relative bg-background rounded-xl shadow-xl border max-h-[90vh] overflow-auto w-full', className)} {...props}>
        {children}
        <button type="button" aria-label="Close" onClick={() => onOpenChange?.(false)} className="absolute right-3 top-3 rounded-md p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
    </div>
  )
})
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }) => <div className={cn('flex flex-col space-y-1.5 p-6 pb-2', className)} {...props} />
const DialogTitle = React.forwardRef(({ className, id, ...props }, ref) => <h3 ref={ref} id={id || 'dialog-title'} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />)
DialogTitle.displayName = 'DialogTitle'
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />)
DialogDescription.displayName = 'DialogDescription'

export { Dialog, DialogOverlay, DialogContent, DialogHeader, DialogTitle, DialogDescription }
