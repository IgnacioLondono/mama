import { useEffect, useState } from 'react'
import type { ModoVueltas } from '../types'
import styles from './ContadorVueltas.module.css'

const MAX_VUELTAS = 9999
const PRESETS = [10, 20, 30, 50, 100]

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
  const [draft, setDraft] = useState(String(vueltasTotales))
  const ilimitado = modoVueltas === 'ilimitado'

  useEffect(() => {
    setBump(true)
    const t = window.setTimeout(() => setBump(false), 280)
    return () => window.clearTimeout(t)
  }, [vueltaActual])

  useEffect(() => {
    setDraft(String(vueltasTotales))
  }, [vueltasTotales])

  function vibrate() {
    try {
      navigator.vibrate?.(12)
    } catch {
      /* ignore */
    }
  }

  function clampObjetivo(n: number) {
    return Math.max(1, Math.min(MAX_VUELTAS, Math.floor(n)))
  }

  function aplicarObjetivo(n: number) {
    const next = clampObjetivo(n)
    setDraft(String(next))
    onObjetivoChange(next)
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
        <div className={styles.objetivoBlock}>
          <label className={styles.objetivo} htmlFor="vueltas-objetivo">
            <span>Vueltas a hacer</span>
            <div className={styles.objetivoRow}>
              <button
                type="button"
                className={styles.objBtn}
                aria-label="Bajar 5 vueltas"
                onClick={() => aplicarObjetivo(vueltasTotales - 5)}
              >
                −5
              </button>
              <input
                id="vueltas-objetivo"
                type="number"
                min={1}
                max={MAX_VUELTAS}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  const n = Number(draft)
                  if (Number.isFinite(n) && n >= 1) aplicarObjetivo(n)
                  else setDraft(String(vueltasTotales))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
              />
              <button
                type="button"
                className={styles.objBtn}
                aria-label="Subir 5 vueltas"
                onClick={() => aplicarObjetivo(vueltasTotales + 5)}
              >
                +5
              </button>
            </div>
          </label>
          <div className={styles.presets} aria-label="Atajos de vueltas">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className={
                  vueltasTotales === n ? styles.presetOn : styles.preset
                }
                onClick={() => aplicarObjetivo(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={`${styles.number} ${bump ? styles.bump : ''}`}
        aria-live="polite"
      >
        <span className={styles.current}>{vueltaActual}</span>
        {!ilimitado ? (
          <>
            <span className={styles.sep}>/</span>
            <span className={styles.total}>{vueltasTotales}</span>
          </>
        ) : null}
      </div>
      <p className={styles.hint}>
        {ilimitado ? 'vueltas (sin tope)' : 'vueltas'}
      </p>

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
          <button
            type="button"
            className="btn btn-sage"
            onClick={onSiguienteParte}
          >
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
