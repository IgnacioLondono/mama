import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Modal.module.css'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  size?: 'md' | 'lg' | 'xl'
  /** Si false, no muestra botones (el contenido trae su propio pie). */
  showActions?: boolean
  onConfirm?: () => void
  onCancel: () => void
}

export function Modal({
  open,
  title,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  size = 'md',
  showActions = true,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmingRef = useRef(false)

  useEffect(() => {
    if (!busy) confirmingRef.current = false
  }, [busy])

  useEffect(() => {
    if (!open) {
      confirmingRef.current = false
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onCancel])

  if (!open) return null

  function handleConfirm() {
    if (!onConfirm || busy || confirmingRef.current) return
    confirmingRef.current = true
    onConfirm()
  }

  const sizeClass =
    size === 'xl' ? styles.dialogXl : size === 'lg' ? styles.dialogLg : ''

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className={`${styles.dialog} ${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onCancel}
            disabled={busy}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        {showActions ? (
          <footer className={styles.actions}>
            <button
              ref={cancelRef}
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            {onConfirm ? (
              <button
                type="button"
                className={danger ? 'btn btn-danger' : 'btn btn-sage'}
                disabled={busy}
                onClick={handleConfirm}
              >
                {busy ? 'Un momento…' : confirmLabel}
              </button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
