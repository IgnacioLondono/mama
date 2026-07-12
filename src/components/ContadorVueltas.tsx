import { useEffect, useState } from 'react'
import type { ModoVueltas } from '../types'
import styles from './ContadorVueltas.module.css'

interface Props {
  vueltaActual: number
  vueltasTotales: number
  modoVueltas: ModoVueltas
  parteNombre: string
  onChange: (next: number) => void
  onModoChange: (modo: ModoVueltas) => void
  onObjetivoChange: (n: number) => void
  onSiguienteParte?: () => void
  tieneSiguiente?: boolean
}

export function ContadorVueltas({
  vueltaActual,
  vueltasTotales,
  modoVueltas,
  parteNombre,
  onChange,
  onModoChange,
  onObjetivoChange,
  onSiguienteParte,
  tieneSiguiente,
}: Props) {
  const [bump, setBump] = useState(false)
  const ilimitado = modoVueltas === 'ilimitado'

  useEffect(() => {
    setBump(true)
    const t = window.setTimeout(() => setBump(false), 280)
    return () => window.clearTimeout(t)
  }, [vueltaActual])

  function vibrate() {
    try {
      navigator.vibrate?.(12)
    } catch {
      /* ignore */
    }
  }

  function inc() {
    if (!ilimitado && vueltaActual >= vueltasTotales) return
    vibrate()
    onChange(vueltaActual + 1)
  }

  function dec() {
    if (vueltaActual <= 0) return
    vibrate()
    onChange(vueltaActual - 1)
  }

  function reset() {
    vibrate()
    onChange(0)
  }

  const done = !ilimitado && vueltaActual >= vueltasTotales && vueltasTotales > 0

  return (
    <section className={styles.card} aria-labelledby="contador-titulo">
      <p className={styles.eyebrow}>Estás en</p>
      <h2 id="contador-titulo" className={styles.title}>
        {parteNombre}
      </h2>

      <div className={styles.modo}>
        <button
          type="button"
          className={`${styles.modoBtn} ${!ilimitado ? styles.modoOn : ''}`}
          onClick={() => onModoChange('fijo')}
        >
          Con tope
        </button>
        <button
          type="button"
          className={`${styles.modoBtn} ${ilimitado ? styles.modoOn : ''}`}
          onClick={() => onModoChange('ilimitado')}
        >
          Ilimitadas
        </button>
      </div>

      {!ilimitado ? (
        <label className={styles.objetivo}>
          <span>Vueltas a hacer</span>
          <input
            type="number"
            min={1}
            max={999}
            value={vueltasTotales}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n) && n >= 1) onObjetivoChange(Math.floor(n))
            }}
          />
        </label>
      ) : null}

      <div className={`${styles.number} ${bump ? styles.bump : ''}`} aria-live="polite">
        <span className={styles.current}>{vueltaActual}</span>
        {!ilimitado ? (
          <>
            <span className={styles.sep}>/</span>
            <span className={styles.total}>{vueltasTotales}</span>
          </>
        ) : null}
      </div>
      <p className={styles.hint}>{ilimitado ? 'vueltas (sin tope)' : 'vueltas'}</p>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.ctrl} ${styles.minus}`}
          onClick={dec}
          aria-label="Restar una vuelta"
          disabled={vueltaActual <= 0}
        >
          −
        </button>
        <button
          type="button"
          className={`${styles.ctrl} ${styles.plus}`}
          onClick={inc}
          aria-label="Sumar una vuelta"
          disabled={!ilimitado && vueltaActual >= vueltasTotales}
        >
          +
        </button>
      </div>

      <div className={styles.footer}>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          Empezar esta parte de nuevo
        </button>
        {done && tieneSiguiente && onSiguienteParte ? (
          <button type="button" className="btn btn-sage btn-lg" onClick={onSiguienteParte}>
            Pasar a la siguiente
          </button>
        ) : null}
        {done && !tieneSiguiente ? (
          <p className={styles.doneMsg}>Listo: esa era la última parte.</p>
        ) : null}
      </div>
    </section>
  )
}
