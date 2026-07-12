import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArchivoPreview } from '../components/ArchivoPreview'
import {
  IconBook,
  IconCheck,
  IconNeedles,
  IconYarn,
} from '../components/Icons'
import { Modal } from '../components/Modal'
import { ProgresoBar } from '../components/ProgresoBar'
import { PatronTemaIcon } from '../components/TemaColorPicker'
import { useAppData } from '../context/AppDataContext'
import type {
  ArchivoMeta,
  Dificultad,
  Material,
  Patron,
  Proyecto,
} from '../types'
import {
  COLORES_CARPETA,
  normalizarColorCarpeta,
  normalizarIconoPatron,
} from '../types'
import styles from './Home.module.css'

const difLabels: Record<Dificultad, string> = {
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
}

function pickPreview(archivos: ArchivoMeta[] | undefined): ArchivoMeta | undefined {
  if (!archivos?.length) return undefined
  return (
    archivos.find(
      (a) =>
        a.tipo === 'application/pdf' ||
        a.nombre.toLowerCase().endsWith('.pdf') ||
        a.tipo.startsWith('image/'),
    ) ?? archivos[0]
  )
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
  })
}

function stockEstado(m: Material): 'ok' | 'bajo' | 'agotado' {
  if (m.cantidad <= 0) return 'agotado'
  if (m.minimo != null && m.cantidad <= m.minimo) return 'bajo'
  return 'ok'
}

function parteActual(proyecto: Proyecto, patron: Patron | undefined) {
  if (!patron?.partes.length) return null
  const parte =
    patron.partes.find((p) => p.id === proyecto.parteActivaId) ??
    patron.partes[0]
  const prog = proyecto.progreso.find((x) => x.parteId === parte.id)
  return {
    nombre: parte.nombre,
    vuelta: prog?.vueltaActual ?? 0,
    total: parte.vueltasTotales,
  }
}

function PatronThumb({ patron }: { patron: Patron | undefined }) {
  if (!patron) {
    return (
      <span className={styles.thumbFallback}>
        <IconBook width={24} height={24} />
      </span>
    )
  }
  const preview = pickPreview(patron.archivos)
  const hex =
    COLORES_CARPETA.find((c) => c.id === normalizarColorCarpeta(patron.colorCarpeta))
      ?.hex ?? '#c45f48'
  const icono = normalizarIconoPatron(patron.icono)

  if (preview) {
    return (
      <span className={styles.thumb}>
        <ArchivoPreview archivo={preview} alt={patron.nombre} />
      </span>
    )
  }

  return (
    <span className={styles.thumbFallback} style={{ background: hex }}>
      <PatronTemaIcon id={icono} size={28} />
    </span>
  )
}

export function Home() {
  const navigate = useNavigate()
  const {
    patrones,
    proyectos,
    materiales,
    progresoPorcentaje,
    limpiarProyectosDuplicados,
    marcarSiguiente,
    completarProyecto,
    deleteProyecto,
    startProyecto,
    getPatron,
  } = useAppData()
  const [limpiando, setLimpiando] = useState(false)
  const [busy, setBusy] = useState(false)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [finId, setFinId] = useState<string | null>(null)
  const [borrarId, setBorrarId] = useState<string | null>(null)

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

  const terminados = useMemo(
    () =>
      proyectos
        .filter((p) => p.estado === 'terminado')
        .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn)),
    [proyectos],
  )

  const materialesBajos = useMemo(
    () => materiales.filter((m) => stockEstado(m) !== 'ok'),
    [materiales],
  )

  const progresoMedio = useMemo(() => {
    if (activos.length === 0) return 0
    const sum = activos.reduce((s, p) => s + progresoPorcentaje(p), 0)
    return Math.round(sum / activos.length)
  }, [activos, progresoPorcentaje])

  const spotlight = activos.find((p) => p.siguiente) ?? activos[0]
  const cola = spotlight
    ? activos.filter((p) => p.id !== spotlight.id)
    : activos

  const patronesSugeridos = useMemo(
    () => [...patrones].slice(0, 4),
    [patrones],
  )

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
      if (
        scores.some((s) => s === 0 && max > 0) ||
        scores.filter((s) => s === 0).length > 1
      ) {
        return true
      }
    }
    return false
  }, [activos])

  const aTerminar = finId ? proyectos.find((p) => p.id === finId) : undefined
  const aBorrar = borrarId ? proyectos.find((p) => p.id === borrarId) : undefined
  const spotlightPatron = spotlight ? getPatron(spotlight.patronId) : undefined
  const spotlightParte = spotlight
    ? parteActual(spotlight, spotlightPatron)
    : null
  const spotlightPct = spotlight ? progresoPorcentaje(spotlight) : 0

  async function onLimpiarDup() {
    if (limpiando) return
    setLimpiando(true)
    try {
      await limpiarProyectosDuplicados()
    } finally {
      setLimpiando(false)
    }
  }

  async function onEmpezar(patronId: string) {
    if (startingId) return
    setStartingId(patronId)
    try {
      const p = await startProyecto(patronId)
      navigate(`/proyectos/${p.id}`)
    } finally {
      setStartingId(null)
    }
  }

  function renderJobCard(p: Proyecto, compact = false) {
    const patron = getPatron(p.patronId)
    const pct = progresoPorcentaje(p)
    const parte = parteActual(p, patron)

    return (
      <li
        key={p.id}
        className={`${styles.job} ${p.siguiente ? styles.jobNext : ''} ${compact ? styles.jobCompact : ''}`}
      >
        <PatronThumb patron={patron} />
        <div className={styles.jobBody}>
          <div className={styles.jobHead}>
            <div>
              <Link to={`/proyectos/${p.id}`} className={styles.jobTitle}>
                {p.nombre}
              </Link>
              <p className={styles.jobSub}>
                {patron?.nombre ?? 'Patrón'}
                {patron?.categoria ? ` · ${patron.categoria}` : ''}
              </p>
            </div>
            <div className={styles.jobBadges}>
              {p.siguiente ? (
                <span className={styles.nextBadge}>Siguiente</span>
              ) : null}
              {patron ? (
                <span className={`badge badge-${patron.dificultad}`}>
                  {difLabels[patron.dificultad]}
                </span>
              ) : null}
            </div>
          </div>

          <div className={styles.jobMeta}>
            {parte ? (
              <span>
                {parte.nombre} · vuelta {parte.vuelta}/{parte.total}
              </span>
            ) : (
              <span>Sin avance registrado</span>
            )}
            <span className={styles.jobTime}>
              {formatRelative(p.actualizadoEn)}
            </span>
          </div>

          <ProgresoBar value={pct} />

          {p.notas.trim() ? (
            <p className={styles.jobNote}>{p.notas.trim()}</p>
          ) : null}
        </div>

        <div className={styles.jobActions}>
          <Link to={`/proyectos/${p.id}`} className="btn btn-primary">
            Retomar
          </Link>
          {!p.siguiente ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void marcarSiguiente(p.id)}
            >
              Siguiente
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-sage"
            onClick={() => setFinId(p.id)}
          >
            Terminé
          </button>
          {patron ? (
            <Link
              to={`/patrones/${patron.id}`}
              className="btn btn-ghost"
            >
              Patrón
            </Link>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setBorrarId(p.id)}
          >
            Borrar
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className={`page-enter ${styles.desk}`}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>Mesa de trabajo</p>
          <h1>Tu espacio para tejer</h1>
          <p className={styles.lead}>
            Retomá donde lo dejaste, marcá el siguiente proyecto y llevá el
            control del stock desde un solo lugar.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link to="/patrones" className="btn btn-secondary">
            Ver patrones
          </Link>
          <Link to="/patrones" className="btn btn-primary">
            Empezar otro
          </Link>
        </div>
      </header>

      <section className={styles.stats} aria-label="Resumen de la mesa">
        <article className={styles.statCard}>
          <span className={styles.statLabel}>En la mesa</span>
          <strong className={styles.statValue}>{activos.length}</strong>
          <span className={styles.statHint}>
            {activos.length === 1 ? 'proyecto activo' : 'proyectos activos'}
          </span>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Progreso medio</span>
          <strong className={styles.statValue}>{progresoMedio}%</strong>
          <span className={styles.statHint}>de los tejidos activos</span>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Patrones</span>
          <strong className={styles.statValue}>{patrones.length}</strong>
          <span className={styles.statHint}>en la estantería</span>
        </article>
        <article
          className={`${styles.statCard} ${materialesBajos.length ? styles.statWarn : ''}`}
        >
          <span className={styles.statLabel}>Stock bajo</span>
          <strong className={styles.statValue}>{materialesBajos.length}</strong>
          <span className={styles.statHint}>
            {materialesBajos.length ? 'ítems por revisar' : 'todo en orden'}
          </span>
        </article>
      </section>

      {hayDuplicadosVacios ? (
        <div className={styles.dupAlert}>
          <p>
            Hay copias vacías del mismo tejido. Podés quitarlas sin tocar el que
            ya tiene avance.
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

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {spotlight ? (
            <section className={styles.spotlight} aria-label="Proyecto destacado">
              <div className={styles.spotlightHead}>
                <span className={styles.spotlightKicker}>
                  {spotlight.siguiente ? 'Tu siguiente tejido' : 'Retomar ahora'}
                </span>
                {spotlight.siguiente ? (
                  <span className={styles.nextBadge}>Siguiente</span>
                ) : null}
              </div>
              <div className={styles.spotlightBody}>
                <PatronThumb patron={spotlightPatron} />
                <div className={styles.spotlightInfo}>
                  <h2>{spotlight.nombre}</h2>
                  <p className={styles.spotlightSub}>
                    {spotlightPatron?.nombre ?? 'Patrón'}
                    {spotlightPatron?.categoria
                      ? ` · ${spotlightPatron.categoria}`
                      : ''}
                    {spotlightPatron
                      ? ` · ${difLabels[spotlightPatron.dificultad]}`
                      : ''}
                  </p>
                  {spotlightParte ? (
                    <p className={styles.spotlightParte}>
                      {spotlightParte.nombre} — vuelta{' '}
                      <strong>
                        {spotlightParte.vuelta}/{spotlightParte.total}
                      </strong>
                    </p>
                  ) : null}
                  <ProgresoBar value={spotlightPct} />
                  <p className={styles.spotlightTime}>
                    Actualizado {formatRelative(spotlight.actualizadoEn)}
                  </p>
                </div>
              </div>
              <div className={styles.spotlightActions}>
                <Link
                  to={`/proyectos/${spotlight.id}`}
                  className="btn btn-primary btn-lg"
                >
                  Abrir mesa
                </Link>
                {!spotlight.siguiente ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void marcarSiguiente(spotlight.id)}
                  >
                    Marcar siguiente
                  </button>
                ) : null}
                {spotlightPatron ? (
                  <Link
                    to={`/patrones/${spotlightPatron.id}`}
                    className="btn btn-ghost"
                  >
                    Ver patrón
                  </Link>
                ) : null}
              </div>
            </section>
          ) : (
            <section className={styles.emptySpotlight}>
              <span className={styles.emptyIcon} aria-hidden>
                <IconNeedles width={32} height={32} />
              </span>
              <h2>Nada en la mesa todavía</h2>
              <p>Elegí un patrón de la estantería y empezá a tejer.</p>
              <Link to="/patrones" className="btn btn-primary btn-lg">
                Ir a patrones
              </Link>
            </section>
          )}

          <section className={styles.board}>
            <div className={styles.boardHead}>
              <div>
                <h2>Cola de trabajo</h2>
                <p>
                  {cola.length === 0
                    ? 'No hay más proyectos en espera'
                    : `${cola.length} ${cola.length === 1 ? 'proyecto' : 'proyectos'} en cola`}
                </p>
              </div>
              <Link to="/proyectos">Ver tejiendo</Link>
            </div>

            {cola.length === 0 ? (
              <div className={styles.emptyQueue}>
                <p>
                  {activos.length === 0
                    ? 'Cuando empieces un tejido, aparecerá acá.'
                    : 'Solo tenés un proyecto activo por ahora.'}
                </p>
              </div>
            ) : (
              <ul className={styles.queue}>{cola.map((p) => renderJobCard(p))}</ul>
            )}
          </section>
        </div>

        <aside className={styles.sideCol}>
          {materialesBajos.length > 0 ? (
            <section className={styles.sidePanel}>
              <div className={styles.sideHead}>
                <span className={styles.sideIconWarn}>
                  <IconYarn width={18} height={18} />
                </span>
                <div>
                  <h3>Stock bajo</h3>
                  <p>{materialesBajos.length} ítems por revisar</p>
                </div>
              </div>
              <ul className={styles.sideList}>
                {materialesBajos.slice(0, 4).map((m) => (
                  <li key={m.id} className={styles.sideItem}>
                    <strong>{m.nombre}</strong>
                    <span>
                      {m.cantidad} {m.unidad}
                      {stockEstado(m) === 'agotado' ? ' · agotado' : ' · bajo'}
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/materiales" className={styles.sideLink}>
                Ir al inventario
              </Link>
            </section>
          ) : null}

          <section className={styles.sidePanel}>
            <div className={styles.sideHead}>
              <span className={styles.sideIcon}>
                <IconCheck width={18} height={18} />
              </span>
              <div>
                <h3>Terminados</h3>
                <p>{terminados.length} en total</p>
              </div>
            </div>
            {terminados.length === 0 ? (
              <p className={styles.sideEmpty}>Todavía no hay tejidos terminados.</p>
            ) : (
              <ul className={styles.sideList}>
                {terminados.slice(0, 4).map((p) => (
                  <li key={p.id} className={styles.sideItem}>
                    <Link to={`/proyectos/${p.id}`}>{p.nombre}</Link>
                    <span>{formatRelative(p.actualizadoEn)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/proyectos" className={styles.sideLink}>
              Ver todos
            </Link>
          </section>

          {patronesSugeridos.length > 0 ? (
            <section className={styles.sidePanel}>
              <div className={styles.sideHead}>
                <span className={styles.sideIcon}>
                  <IconBook width={18} height={18} />
                </span>
                <div>
                  <h3>Desde la estantería</h3>
                  <p>Empezar rápido</p>
                </div>
              </div>
              <ul className={styles.suggestList}>
                {patronesSugeridos.map((patron) => (
                  <li key={patron.id} className={styles.suggestItem}>
                    <PatronThumb patron={patron} />
                    <div className={styles.suggestText}>
                      <strong>{patron.nombre}</strong>
                      <span>
                        {patron.categoria} · {difLabels[patron.dificultad]}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={startingId === patron.id}
                      onClick={() => void onEmpezar(patron.id)}
                    >
                      {startingId === patron.id ? '…' : 'Tejer'}
                    </button>
                  </li>
                ))}
              </ul>
              <Link to="/patrones" className={styles.sideLink}>
                Ver estantería
              </Link>
            </section>
          ) : null}

          <nav className={styles.quickNav} aria-label="Accesos rápidos">
            <Link to="/patrones" className={styles.quickLink}>
              <IconBook width={16} height={16} />
              Patrones
            </Link>
            <Link to="/materiales" className={styles.quickLink}>
              <IconYarn width={16} height={16} />
              Inventario
            </Link>
            <Link to="/proyectos" className={styles.quickLink}>
              <IconNeedles width={16} height={16} />
              Tejiendo
            </Link>
          </nav>
        </aside>
      </div>

      <Modal
        open={Boolean(finId)}
        title="¿Ya lo terminaste?"
        confirmLabel="Sí, terminé"
        cancelLabel="Seguir tejiendo"
        busy={busy}
        onCancel={() => {
          if (!busy) setFinId(null)
        }}
        onConfirm={() => {
          if (!finId) return
          void (async () => {
            setBusy(true)
            try {
              await completarProyecto(finId)
              setFinId(null)
            } finally {
              setBusy(false)
            }
          })()
        }}
      >
        <p>
          Se marcará <strong>{aTerminar?.nombre ?? 'este tejido'}</strong> como
          terminado.
        </p>
      </Modal>

      <Modal
        open={Boolean(borrarId)}
        title="¿Borrar este tejido?"
        confirmLabel="Sí, borrar"
        cancelLabel="Dejarlo"
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setBorrarId(null)
        }}
        onConfirm={() => {
          if (!borrarId) return
          void (async () => {
            setBusy(true)
            try {
              await deleteProyecto(borrarId)
              setBorrarId(null)
            } finally {
              setBusy(false)
            }
          })()
        }}
      >
        <p>
          Se borrará <strong>{aBorrar?.nombre ?? 'este tejido'}</strong> y no se
          podrá recuperar.
        </p>
      </Modal>
    </div>
  )
}
