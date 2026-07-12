import { useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArchivoPreview } from '../components/ArchivoPreview'
import { useAppData } from '../context/AppDataContext'
import { uid } from '../lib/storage'
import type { ArchivoMeta, Dificultad, Patron } from '../types'
import styles from './Patrones.module.css'

const labels: Record<Dificultad, string> = {
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
}

const emptyForm = {
  nombre: '',
  descripcion: '',
  dificultad: 'facil' as Dificultad,
  tiempoEstimado: '',
}

const ACCEPT = 'application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp'

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

export function Patrones() {
  const { patrones, addPatron, deletePatron, uploadArchivoPatron } = useAppData()
  const [q, setQ] = useState('')
  const [dif, setDif] = useState<'todas' | Dificultad>('todas')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [pendientes, setPendientes] = useState<File[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return patrones.filter((p) => {
      const matchQ =
        !query ||
        p.nombre.toLowerCase().includes(query) ||
        p.descripcion.toLowerCase().includes(query)
      const matchD = dif === 'todas' || p.dificultad === dif
      return matchQ && matchD
    })
  }, [patrones, q, dif])

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => {
      const okType =
        f.type === 'application/pdf' ||
        f.type.startsWith('image/') ||
        /\.(pdf|png|jpe?g|webp)$/i.test(f.name)
      return okType && f.size <= 25 * 1024 * 1024
    })
    if (list.length === 0) return
    setPendientes((prev) => {
      const names = new Set(prev.map((f) => `${f.name}-${f.size}`))
      const next = list.filter((f) => !names.has(`${f.name}-${f.size}`))
      return [...prev, ...next]
    })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setSubiendo(true)
    try {
      const parteId = uid('parte')
      const nuevo: Omit<Patron, 'id' | 'archivos' | 'archivoActivoId'> = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || 'Sin notas todavía',
        dificultad: form.dificultad,
        tiempoEstimado: form.tiempoEstimado.trim() || 'Sin estimar',
        materiales: [],
        abreviaciones: ['pb: punto bajo', 'aum: aumento', 'dis: disminución'],
        partes: [
          {
            id: parteId,
            nombre: 'Parte 1',
            vueltasTotales: 10,
            instrucciones: [
              'V1: 6 pb en anillo mágico',
              'Sigue con tus apuntes…',
            ],
          },
        ],
      }
      const creado = await addPatron(nuevo)
      for (const file of pendientes) {
        await uploadArchivoPatron(creado.id, file)
      }
      setForm(emptyForm)
      setPendientes([])
      setShowForm(false)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className={`page-enter ${styles.desk}`}>
      <header className={styles.top}>
        <div>
          <p className={styles.kicker}>Estantería</p>
          <h1>Patrones</h1>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cerrar mesa' : 'Anotar en la mesa'}
        </button>
      </header>

      {showForm ? (
        <form
          className={styles.bench}
          onSubmit={(e) => void onSubmit(e)}
        >
          <div className={styles.benchBar}>
            <div>
              <p className={styles.kicker}>Mesa de anotación</p>
              <h2>Nuevo patrón</h2>
            </div>
            <div className={styles.benchActions}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowForm(false)
                  setForm(emptyForm)
                  setPendientes([])
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-sage" disabled={subiendo}>
                {subiendo ? 'Guardando…' : 'Guardar en la estantería'}
              </button>
            </div>
          </div>

          <div className={styles.benchGrid}>
            <section
              className={`${styles.dropzone} ${dragging ? styles.dropOn : ''} ${pendientes.length ? styles.dropFilled : ''}`}
              onDragEnter={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileRef}
                id="archivos"
                type="file"
                className="sr-only"
                multiple
                accept={ACCEPT}
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <p className={styles.dropTitle}>PDF / fotos</p>
              <p className={styles.dropText}>
                Arrastra aquí el patrón o
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
              >
                Elegir archivo
              </button>

              {pendientes.length > 0 ? (
                <ul className={styles.fileTray}>
                  {pendientes.map((f) => (
                    <li key={`${f.name}-${f.size}`}>
                      <span>{f.name}</span>
                      <button
                        type="button"
                        aria-label={`Quitar ${f.name}`}
                        onClick={() =>
                          setPendientes((prev) =>
                            prev.filter(
                              (x) => `${x.name}-${x.size}` !== `${f.name}-${f.size}`,
                            ),
                          )
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.dropHint}>PDF, PNG o JPG · máx. 25 MB</p>
              )}
            </section>

            <section className={styles.notes}>
              <div className={styles.field}>
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej. Osito beige"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="desc">Notas</label>
                <textarea
                  id="desc"
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                  placeholder="Hilo, aguja, detalles…"
                />
              </div>
              <div className={styles.metaRow}>
                <div className={styles.field}>
                  <label htmlFor="dif">Dificultad</label>
                  <select
                    id="dif"
                    value={form.dificultad}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        dificultad: e.target.value as Dificultad,
                      })
                    }
                  >
                    <option value="facil">Fácil</option>
                    <option value="media">Media</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="tiempo">Tiempo</label>
                  <input
                    id="tiempo"
                    value={form.tiempoEstimado}
                    onChange={(e) =>
                      setForm({ ...form, tiempoEstimado: e.target.value })
                    }
                    placeholder="ej. 5 h"
                  />
                </div>
              </div>
            </section>
          </div>
        </form>
      ) : null}

      <div className={styles.shelfBar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar en la estantería…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar patrón"
        />
        <select
          className={styles.filter}
          value={dif}
          onChange={(e) => setDif(e.target.value as 'todas' | Dificultad)}
          aria-label="Filtrar por dificultad"
        >
          <option value="todas">Todas</option>
          <option value="facil">Fácil</option>
          <option value="media">Media</option>
          <option value="dificil">Difícil</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.emptyShelf}>
          {showForm
            ? 'Cuando guardes, aparecerá aquí.'
            : 'La estantería está vacía con ese filtro.'}
        </p>
      ) : (
        <ul className={styles.shelf}>
          {filtered.map((p) => {
            const preview = pickPreview(p.archivos)
            return (
              <li key={p.id} className={styles.shelfItem}>
                <Link to={`/patrones/${p.id}`} className={styles.thumbLink}>
                  {preview ? (
                    <ArchivoPreview archivo={preview} alt={p.nombre} />
                  ) : (
                    <div className={styles.noThumb} aria-hidden>
                      —
                    </div>
                  )}
                </Link>
                <div className={styles.shelfMain}>
                  <div className={styles.itemTop}>
                    <Link to={`/patrones/${p.id}`} className={styles.itemTitle}>
                      {p.nombre}
                    </Link>
                    <span className={`badge badge-${p.dificultad}`}>
                      {labels[p.dificultad]}
                    </span>
                  </div>
                  <p className={styles.desc}>{p.descripcion}</p>
                  <p className={styles.meta}>
                    {p.partes.length} partes · {p.tiempoEstimado}
                    {(p.archivos?.length ?? 0) > 0
                      ? ` · ${p.archivos.length} archivo${p.archivos.length === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>
                <div className={styles.shelfActions}>
                  <Link to={`/patrones/${p.id}`} className="btn btn-secondary">
                    Abrir
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (confirm(`¿Borrar «${p.nombre}»?`))
                        void deletePatron(p.id)
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
