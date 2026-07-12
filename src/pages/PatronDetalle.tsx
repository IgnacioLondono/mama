import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AsistenteIa } from '../components/AsistenteIa'
import { VisorArchivos } from '../components/VisorArchivos'
import { useAppData } from '../context/AppDataContext'
import type { Dificultad } from '../types'
import styles from './PatronDetalle.module.css'

const labels: Record<Dificultad, string> = {
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
}

export function PatronDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    getPatron,
    startProyecto,
    updatePatron,
    uploadArchivoPatron,
    replaceArchivoPatron,
    renameArchivoPatron,
    deleteArchivoPatron,
  } = useAppData()
  const patron = id ? getPatron(id) : undefined
  const [editDesc, setEditDesc] = useState(false)
  const [desc, setDesc] = useState(patron?.descripcion ?? '')
  const [editNombre, setEditNombre] = useState(false)
  const [nombreDraft, setNombreDraft] = useState(patron?.nombre ?? '')

  if (!patron) {
    return (
      <div className="page-enter empty">
        <p>Ese patrón no está.</p>
        <Link to="/patrones" className="btn btn-secondary">
          Volver
        </Link>
      </div>
    )
  }

  async function iniciar() {
    const proy = await startProyecto(patron!.id)
    navigate(`/proyectos/${proy.id}`)
  }

  async function guardarDesc() {
    await updatePatron(patron!.id, {
      descripcion: desc.trim() || patron!.descripcion,
    })
    setEditDesc(false)
  }

  async function guardarNombre() {
    const next = nombreDraft.trim() || patron!.nombre
    await updatePatron(patron!.id, { nombre: next })
    setEditNombre(false)
  }

  return (
    <div className={`page-enter ${styles.page}`}>
      <Link to="/patrones" className={styles.back}>
        ← Patrones
      </Link>

      <header className={styles.header}>
        <div className={styles.titleRow}>
          {editNombre ? (
            <div className={styles.nameEdit}>
              <input
                value={nombreDraft}
                onChange={(e) => setNombreDraft(e.target.value)}
                aria-label="Nombre del patrón"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void guardarNombre()
                  }
                  if (e.key === 'Escape') {
                    setNombreDraft(patron.nombre)
                    setEditNombre(false)
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-sage"
                onClick={() => void guardarNombre()}
              >
                Guardar
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setNombreDraft(patron.nombre)
                  setEditNombre(false)
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <h1>{patron.nombre}</h1>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setNombreDraft(patron.nombre)
                  setEditNombre(true)
                }}
              >
                Editar nombre
              </button>
            </>
          )}
          <span className={`badge badge-${patron.dificultad}`}>
            {labels[patron.dificultad]}
          </span>
        </div>
        <p className={styles.meta}>{patron.tiempoEstimado}</p>

        {editDesc ? (
          <div className={styles.editBox}>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-sage"
                onClick={() => void guardarDesc()}
              >
                Guardar
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDesc(patron.descripcion)
                  setEditDesc(false)
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p>{patron.descripcion}</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDesc(patron.descripcion)
                setEditDesc(true)
              }}
            >
              Cambiar nota
            </button>
          </>
        )}
      </header>

      <div className={styles.cta}>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => void iniciar()}
        >
          Empezar a tejerlo
        </button>
      </div>

      <VisorArchivos
        proyectoId={patron.id}
        archivos={patron.archivos ?? []}
        activoId={patron.archivoActivoId ?? null}
        onSelect={(archivoActivoId) =>
          void updatePatron(patron.id, { archivoActivoId })
        }
        onUpload={(file) => uploadArchivoPatron(patron.id, file)}
        onReplace={(archivoId, file) =>
          replaceArchivoPatron(patron.id, archivoId, file)
        }
        onRename={(archivoId, nombre) =>
          renameArchivoPatron(patron.id, archivoId, nombre)
        }
        onDelete={(archivoId) => deleteArchivoPatron(patron.id, archivoId)}
      />

      <section className={`panel ${styles.iaPanel}`}>
        <AsistenteIa
          patronId={patron.id}
          archivoId={patron.archivoActivoId}
        />
      </section>

      <section className="panel">
        <h2>Qué necesitas</h2>
        {patron.materiales.length === 0 ? (
          <p className={styles.muted}>Todavía no anotaste materiales.</p>
        ) : (
          <ul className={styles.plainList}>
            {patron.materiales.map((m) => (
              <li key={m.nombre}>
                <strong>{m.nombre}</strong>
                <span>{m.cantidad}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Abreviaciones</h2>
        <ul className={styles.abbr}>
          {patron.abreviaciones.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>

      <section className={styles.partes}>
        <h2>Partes</h2>
        {patron.partes.map((parte, i) => (
          <article key={parte.id} className={`panel ${styles.parte}`}>
            <h3>
              {i + 1}. {parte.nombre}
            </h3>
            <p className={styles.vueltas}>{parte.vueltasTotales} vueltas</p>
            <ol className={styles.steps}>
              {parte.instrucciones.map((ins) => (
                <li key={ins}>{ins}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    </div>
  )
}
