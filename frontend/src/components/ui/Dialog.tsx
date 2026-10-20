import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import Button from './Button'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  id?: string
  variant?: 'dialog' | 'drawer'
}

export default function Dialog({ open, onClose, title, description, children, id, variant = 'dialog' }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (!open) {
      dialog.close()
      return
    }

    // Native modal dialogs make the background inert and choose initial focus.
    const returnFocus = document.activeElement
    const previousOverflow = document.documentElement.style.overflow
    dialog.showModal()
    document.documentElement.style.overflow = 'hidden'

    return () => {
      dialog.close()
      document.documentElement.style.overflow = previousOverflow
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      className={`devatlas-dialog ${variant === 'drawer' ? 'devatlas-drawer' : ''}`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || event.defaultPrevented) return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]',
        )).filter((element) =>
          element.tabIndex >= 0 && !element.matches(':disabled') &&
          !element.closest('[inert]') && element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== 'hidden',
        )
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
          onClose()
        }
      }}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="text-xl font-bold">{title}</h2>
          {description && <p id={descriptionId} className="mt-2 text-sm text-slate-400">{description}</p>}
        </div>
        <Button variant="ghost" aria-label={`Close ${title}`} onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      {children}
    </dialog>
  )
}
