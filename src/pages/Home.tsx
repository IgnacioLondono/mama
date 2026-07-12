import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconBook,
  IconCheck,
  IconYarn,
} from '../components/Icons'
import { ProgresoBar } from '../components/ProgresoBar'
import { useAppData } from '../context/AppDataContext'
import styles from './Home.module.css'

export function Home() {
  const {
    patrones,
    proyectos,
    materiales,
    progresoPorcentaje,
    limpiarProyectosDuplicados,
    marcarSiguiente,
  } = useAppData()
  const [limpiando, setLimpiando] = useState(false)

  const activos = useMemo(() => {
    return proyectos
      .filter((p) => p.estado === 'activo')
      .sort((a, b) => {
        if (Boolean(a.siguiente) !== Boolean(b.siguiente)) {
          return a.siguiente ? -1 : 1
        }
        return b.actualizadoEn.localeCompare(a.actualizadoEn)
      })
  }, [proyectos])
  const stockBajo = materiales.filter(
    (m) => m.minimo != null && m.cantidad <= m.minimo,
  ).length

  const hayDuplicadosVacios = useMemo(() => {
    const byPatron = new Map<string, typeof activos>()
    for (const p of activos) {
      const list = byPatron.get(p.patronId) ?? []
      list.push(p)
      byPatron.set(p.patronId, list)
    }
    for (const group of byPatron.values()) {
      if (group.length < 2) continue
      const scores = group.map((p) =>
        p.progreso.reduce((s, x) => s + (x.vueltaActual || 0), 0),
      )
      const max = Math.max(...scores)
      if (scores.some((s) => s === 0 && max > 0) || scores.filter((s) => s === 0).length > 1) {
        return true
      }
    }
    return false
  }, [activos])

  async function onLimpiarDup() {
    if (limpiando) return
    setLimpiando(true)
    try {
      await limpiarProyectosDuplicados()
    } finally {
      setLimpiando(false)
    }
  }

  return (
    <div className={`page-enter ${styles.desk}`}>
      <header className={styles.top}>
        <div>
          <p className={styles.kicker}>Mesa de trabajo</p>
          <h1>Tejidos de Mamá</h1>
        </div>
        <div className={styles.topActions}>
          <Link to="/patrones" className="btn btn-secondary">
            Patrones
          </Link>
          <Link to="/patrones" className="btn btn-primary">
            Empezar otro
          </Link>
        </div>
      </header>

      <section className={styles.strip} aria-label="Resumen">
        <span>
          <strong>{activos.length}</strong> a medias
        </span>
        <span>
          <strong>{patrones.length}</strong> patrones
        </span>
        <span>
          <strong>{stockBajo}</strong> por comprar
        </span>
      </section>

      {hayDuplicadosVacios ? (
        <div className={styles.dupAlert}>
          <p>
            Hay copias vacías del mismo tejido (suele pasar al tocar dos veces
            «Empezar»). Podés quitarlas sin tocar el que ya tiene avance.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={limpiando}
            onClick={() => void onLimpiarDup()}
          >
            {limpiando ? 'Limpiando…' : 'Quitar copias vacías'}
          </button>
        </div>
      ) : null}

      <section className={styles.board}>
        <div className={styles.boardHead}>
          <h2>En la mesa ahora</h2>
          <Link to="/proyectos">Ver todos</Link>
        </div>

        {activos.length === 0 ? (
          <div className={styles.emptyBoard}>
            <p>No hay nada a medias. Elige un patrón y ponte a tejer.</p>
            <Link to="/patrones" className="btn btn-primary btn-lg">
              Ir a patrones
            </Link>
          </div>
        ) : (
          <ul className={styles.queue}>
            {activos.map((p) => {
              const patron = patrones.find((x) => x.id === p.patronId)
              const pct = progresoPorcentaje(p)
              return (
                <li
                  key={p.id}
                  className={`${styles.job} ${p.siguiente ? styles.jobNext : ''}`}
                >
                  <div className={styles.jobMain}>
                    <div className={styles.jobTitleRow}>
                      <h3>{p.nombre}</h3>
                      {p.siguiente ? (
                        <span className={styles.nextBadge}>Siguiente</span>
                      ) : null}
                    </div>
                    <p>
                      {patron?.nombre ?? 'Patrón'}
                      {pct > 0 ? ` · ${pct}%` : ' · Sin avance'}
                    </p>
                    <ProgresoBar value={pct} />
                  </div>
                  <div className={styles.jobActions}>
                    {!p.siguiente ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void marcarSiguiente(p.id)}
                      >
                        Marcar siguiente
                      </button>
                    ) : null}
                    <Link
                      to={`/proyectos/${p.id}`}
                      className="btn btn-primary btn-lg"
                    >
                      Abrir mesa
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <aside className={styles.sideTools}>
        <Link to="/patrones" className={styles.tool}>
          <span className={styles.toolIcon} aria-hidden>
            <IconBook />
          </span>
          <span className={styles.toolText}>
            <strong>Patrones</strong>
            <span>PDF y pasos</span>
          </span>
        </Link>
        <Link to="/materiales" className={styles.tool}>
          <span className={styles.toolIcon} aria-hidden>
            <IconYarn />
          </span>
          <span className={styles.toolText}>
            <strong>Inventario</strong>
            <span>Stock y materiales</span>
          </span>
        </Link>
        <Link to="/proyectos" className={styles.tool}>
          <span className={styles.toolIcon} aria-hidden>
            <IconCheck />
          </span>
          <span className={styles.toolText}>
            <strong>Terminados</strong>
            <span>Lo que ya quedó listo</span>
          </span>
        </Link>
      </aside>
    </div>
  )
}
