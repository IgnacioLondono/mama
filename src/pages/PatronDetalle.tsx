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
    proyectos,
  } = useAppData()
  const patron = id ? getPatron(id) : undefined
  const [editDesc, setEditDesc] = useState(false)
  const [desc, setDesc] = useState(patron?.descripcion ?? '')
  const [editNombre, setEditNombre] = useState(false)
  const [nombreDraft, setNombreDraft] = useState(patron?.nombre ?? '')
  const [starting, setStarting] = useState(false)

  const proyectoActivo = patron
    ? proyectos.find(
        (p) => p.patronId === patron.id && p.estado === 'activo',
      )
    : undefined

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
    if (starting) return
    setStarting(true)
    try {
      const proy = await startProyecto(patron!.id)
      navigate(`/proyectos/${proy.id}`)
    } catch {
      setStarting(false)
    }
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

      <header className={styles.hero}>
        <p className={styles.kicker}>Patrón</p>

        <div className={styles.heroTop}>
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
            <div className={styles.titleBlock}>
              <h1>{patron.nombre}</h1>
              <button
                type="button"
                className={styles.linkEdit}
                onClick={() => {
                  setNombreDraft(patron.nombre)
                  setEditNombre(true)
                }}
              >
                Renombrar
              </button>
            </div>
          )}
        </div>

        <div className={styles.metaRow}>
          <span className={`badge badge-${patron.dificultad}`}>
            {labels[patron.dificultad]}
          </span>
          <span className={styles.metaDot} aria-hidden>
            ·
          </span>
          <span className={styles.metaTime}>{patron.tiempoEstimado}</span>
          <span className={styles.metaDot} aria-hidden>
            ·
          </span>
          <span className={styles.metaTime}>
            {patron.partes.length}{' '}
            {patron.partes.length === 1 ? 'parte' : 'partes'}
          </span>
        </div>

        {editDesc ? (
          <div className={styles.editBox}>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              aria-label="Descripción"
            />
            <div className={styles.editActions}>
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
          <div className={styles.descBlock}>
            <p className={styles.desc}>{patron.descripcion}</p>
            <button
              type="button"
              className={styles.linkEdit}
              onClick={() => {
                setDesc(patron.descripcion)
                setEditDesc(true)
              }}
            >
              Editar nota
            </button>
          </div>
        )}

        <div className={styles.cta}>
          <button
            type="button"
            className={`btn btn-primary btn-lg ${styles.ctaBtn}`}
            disabled={starting}
            onClick={() => void iniciar()}
          >
            {starting
              ? 'Abriendo…'
              : proyectoActivo
                ? 'Seguir tejiendo'
                : 'Empezar a tejerlo'}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <section className={styles.viewerBlock} aria-label="Archivo del patrón">
            <div className={styles.sectionHead}>
              <h2>Archivo</h2>
              <p>PDF o foto del patrón para consultarlo mientras tejés.</p>
            </div>
            <div className={styles.viewerFrame}>
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
            </div>
          </section>

          <section className={styles.partes} aria-label="Partes del patrón">
            <div className={styles.sectionHead}>
              <h2>Partes</h2>
              <p>Pasos anotados para seguir el amigurumi.</p>
            </div>
            <div className={styles.parteList}>
              {patron.partes.map((parte, i) => (
                <article key={parte.id} className={styles.parte}>
                  <div className={styles.parteHead}>
                    <span className={styles.parteNum}>{i + 1}</span>
                    <div>
                      <h3>{parte.nombre}</h3>
                      <p className={styles.vueltas}>
                        {parte.vueltasTotales} vueltas
                      </p>
                    </div>
                  </div>
                  <ol className={styles.steps}>
                    {parte.instrucciones.map((ins, idx) => (
                      <li key={`${parte.id}-${idx}`}>{ins}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.aside}>
          <section className={styles.sideBlock}>
            <h2>Qué necesitas</h2>
            {patron.materiales.length === 0 ? (
              <p className={styles.muted}>Todavía no anotaste materiales.</p>
            ) : (
              <ul className={styles.plainList}>
                {patron.materiales.map((m, idx) => (
                  <li key={`${m.nombre}-${idx}`}>
                    <strong>{m.nombre}</strong>
                    <span>{m.cantidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.sideBlock}>
            <h2>Abreviaciones</h2>
            {patron.abreviaciones.length === 0 ? (
              <p className={styles.muted}>Sin abreviaciones anotadas.</p>
            ) : (
              <ul className={styles.abbr}>
                {patron.abreviaciones.map((a, idx) => (
                  <li key={`${idx}-${a}`}>{a}</li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${styles.sideBlock} ${styles.iaBlock}`}>
            <h2>Ayuda</h2>
            <AsistenteIa
              patronId={patron.id}
              archivoId={patron.archivoActivoId}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
