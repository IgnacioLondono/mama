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
  const { patrones, proyectos, materiales, progresoPorcentaje } = useAppData()
  const activos = proyectos.filter((p) => p.estado === 'activo')
  const stockBajo = materiales.filter(
    (m) => m.minimo != null && m.cantidad <= m.minimo,
  ).length

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
              return (
                <li key={p.id} className={styles.job}>
                  <div className={styles.jobMain}>
                    <h3>{p.nombre}</h3>
                    <p>{patron?.nombre ?? 'Patrón'}</p>
                    <ProgresoBar value={progresoPorcentaje(p)} />
                  </div>
                  <Link
                    to={`/proyectos/${p.id}`}
                    className="btn btn-primary btn-lg"
                  >
                    Abrir mesa
                  </Link>
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
