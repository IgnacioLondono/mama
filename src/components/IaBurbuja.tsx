import { useEffect, useId, useRef, useState } from 'react'
import { AsistenteIa } from './AsistenteIa'
import { IconChat } from './Icons'
import styles from './IaBurbuja.module.css'

interface Props {
  proyectoId?: string
  patronId?: string
  archivoId?: string | null
}

export function IaBurbuja({ proyectoId, patronId, archivoId }: Props) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className={styles.root}>
      {/* Se mantiene montado para no perder el chat al cerrar */}
      <div
        className={`${styles.panel} ${open ? '' : styles.panelHidden}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-hidden={!open}
        hidden={!open}
      >
        <div className={styles.panelHead}>
          <h2 id={titleId}>Ayuda</h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={() => setOpen(false)}
            aria-label="Cerrar ayuda"
            tabIndex={open ? 0 : -1}
          >
            ×
          </button>
        </div>
        <div className={styles.panelBody}>
          <AsistenteIa
            proyectoId={proyectoId}
            patronId={patronId}
            archivoId={archivoId}
          />
        </div>
      </div>

      <button
        type="button"
        className={`${styles.bubble} ${open ? styles.bubbleOn : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Cerrar ayuda de tejido' : 'Abrir ayuda de tejido'}
        title="Ayuda de tejido"
      >
        <IconChat width={24} height={24} />
      </button>
    </div>
  )
}
