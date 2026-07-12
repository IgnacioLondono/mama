import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconBook, IconCheck, IconNeedles } from '../components/Icons'
import { Modal } from '../components/Modal'
import { ProgresoBar } from '../components/ProgresoBar'
import { useAppData } from '../context/AppDataContext'
import styles from './Proyectos.module.css'

export function Proyectos() {
  const {
    proyectos,
    getPatron,
    progresoPorcentaje,
    deleteProyecto,
    completarProyecto,
  } = useAppData()
  const [finId, setFinId] = useState<string | null>(null)
  const [borrarId, setBorrarId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const activos = proyectos.filter((p) => p.estado === 'activo')
  const terminados = proyectos.filter((p) => p.estado === 'terminado')
  const aTerminar = finId ? proyectos.find((p) => p.id === finId) : undefined
  const aBorrar = borrarId
    ? proyectos.find((p) => p.id === borrarId)
    : undefined

  return (
    <div className={`page-enter ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.kicker}>Tejiendo</p>
          <h1>Lo que tienes entre manos</h1>
          <p className={styles.lead}>
            Retoma las vueltas donde las dejaste.
          </p>
        </div>
        <Link to="/patrones" className="btn btn-primary">
          Empezar otro
        </Link>
      </header>

      <section className={styles.strip} aria-label="Resumen">
        <span>
          <strong>{activos.length}</strong> a medias
        </span>
        <span>
          <strong>{terminados.length}</strong> terminados
        </span>
      </section>

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

      <div className={styles.columns}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={`${styles.panelIcon} ${styles.iconActive}`}>
              <IconNeedles />
            </span>
            <div>
              <h2>A medias</h2>
              <p>{activos.length} en la mesa</p>
            </div>
          </div>

          {activos.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <IconBook width={28} height={28} />
              </span>
              <p>Todavía no hay nada empezado.</p>
              <Link to="/patrones" className="btn btn-secondary">
                Elegir un patrón
              </Link>
            </div>
          ) : (
            <ul className={styles.list}>
              {activos.map((p) => {
                const patron = getPatron(p.patronId)
                const pct = progresoPorcentaje(p)
                return (
                  <li key={p.id} className={styles.item}>
                    <div className={styles.itemTop}>
                      <div>
                        <Link
                          to={`/proyectos/${p.id}`}
                          className={styles.title}
                        >
                          {p.nombre}
                        </Link>
                        <p className={styles.sub}>
                          {patron?.nombre ?? 'Patrón borrado'}
                        </p>
                      </div>
                      <span className="badge badge-activo">A medias</span>
                    </div>
                    <ProgresoBar value={pct} />
                    <div className={styles.actions}>
                      <Link
                        to={`/proyectos/${p.id}`}
                        className="btn btn-primary"
                      >
                        Seguir
                      </Link>
                      <button
                        type="button"
                        className="btn btn-sage"
                        onClick={() => setFinId(p.id)}
                      >
                        Ya terminé
                      </button>
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
              })}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={`${styles.panelIcon} ${styles.iconDone}`}>
              <IconCheck />
            </span>
            <div>
              <h2>Terminados</h2>
              <p>{terminados.length} listos</p>
            </div>
          </div>

          {terminados.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <IconCheck width={28} height={28} />
              </span>
              <p>Cuando acabes uno, aparecerá aquí.</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {terminados.map((p) => (
                <li key={p.id} className={styles.item}>
                  <div className={styles.itemTop}>
                    <div>
                      <Link
                        to={`/proyectos/${p.id}`}
                        className={styles.title}
                      >
                        {p.nombre}
                      </Link>
                      <p className={styles.sub}>Terminado</p>
                    </div>
                    <span className="badge badge-terminado">Listo</span>
                  </div>
                  <ProgresoBar value={progresoPorcentaje(p)} />
                  <div className={styles.actions}>
                    <Link
                      to={`/proyectos/${p.id}`}
                      className="btn btn-secondary"
                    >
                      Abrir
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setBorrarId(p.id)}
                    >
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
