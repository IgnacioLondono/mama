import { useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArchivoPreview } from '../components/ArchivoPreview'
import { Modal } from '../components/Modal'
import { TemaColorPicker, PatronTemaIcon } from '../components/TemaColorPicker'
import { useAppData } from '../context/AppDataContext'
import { uid } from '../lib/storage'
import type {
  ArchivoMeta,
  CategoriaPatron,
  ColorCarpeta,
  Dificultad,
  IconoPatron,
  Patron,
} from '../types'
import {
  CATEGORIAS_PATRON,
  COLORES_CARPETA,
  ICONOS_PATRON,
  normalizarColorCarpeta,
  normalizarIconoPatron,
} from '../types'
import styles from './Patrones.module.css'

const labels: Record<Dificultad, string> = {
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
}

const difRank: Record<Dificultad, number> = {
  facil: 0,
  media: 1,
  dificil: 2,
}

const emptyForm = {
  nombre: '',
  descripcion: '',
  dificultad: 'facil' as Dificultad,
  tiempoEstimado: '',
  categoria: 'Amigurumi' as CategoriaPatron,
  icono: 'carpeta' as IconoPatron,
  colorCarpeta: 'coral' as ColorCarpeta,
}

type Orden = 'nombre' | 'categoria' | 'dificultad' | 'carpeta'

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

function carpetaKey(p: Patron) {
  const tema = normalizarIconoPatron(p.icono)
  const color = normalizarColorCarpeta(p.colorCarpeta)
  return `${tema}::${color}`
}

function carpetaLabel(tema: IconoPatron, color: ColorCarpeta) {
  const temaLbl = ICONOS_PATRON.find((i) => i.id === tema)?.label ?? tema
  const colorLbl = COLORES_CARPETA.find((c) => c.id === color)?.label ?? color
  return `${temaLbl} · ${colorLbl}`
}

export function Patrones() {
  const {
    patrones,
    addPatron,
    updatePatron,
    deletePatron,
    uploadArchivoPatron,
  } = useAppData()
  const [q, setQ] = useState('')
  const [dif, setDif] = useState<'todas' | Dificultad>('todas')
  const [cat, setCat] = useState<'todas' | CategoriaPatron>('todas')
  const [orden, setOrden] = useState<Orden>('carpeta')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [pendientes, setPendientes] = useState<File[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [borrarId, setBorrarId] = useState<string | null>(null)
  const [carpetaId, setCarpetaId] = useState<string | null>(null)
  const [carpetaForm, setCarpetaForm] = useState({
    categoria: 'Amigurumi' as CategoriaPatron,
    icono: 'carpeta' as IconoPatron,
    colorCarpeta: 'coral' as ColorCarpeta,
  })
  const fileRef = useRef<HTMLInputElement>(null)

  const aBorrar = borrarId
    ? patrones.find((p) => p.id === borrarId)
    : undefined
  const aCarpeta = carpetaId
    ? patrones.find((p) => p.id === carpetaId)
    : undefined

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    const list = patrones.filter((p) => {
      const matchQ =
        !query ||
        p.nombre.toLowerCase().includes(query) ||
        p.descripcion.toLowerCase().includes(query) ||
        (p.categoria ?? '').toLowerCase().includes(query)
      const matchD = dif === 'todas' || p.dificultad === dif
      const matchC = cat === 'todas' || p.categoria === cat
      return matchQ && matchD && matchC
    })

    return [...list].sort((a, b) => {
      if (orden === 'carpeta') {
        const ka = carpetaKey(a)
        const kb = carpetaKey(b)
        if (ka !== kb) return ka.localeCompare(kb, 'es')
        return a.nombre.localeCompare(b.nombre, 'es')
      }
      if (orden === 'categoria')
        return (a.categoria ?? '').localeCompare(b.categoria ?? '', 'es')
      if (orden === 'dificultad')
        return difRank[a.dificultad] - difRank[b.dificultad]
      return a.nombre.localeCompare(b.nombre, 'es')
    })
  }, [patrones, q, dif, cat, orden])

  const carpetas = useMemo(() => {
    const map = new Map<
      string,
      { tema: IconoPatron; color: ColorCarpeta; items: Patron[] }
    >()
    for (const p of filtered) {
      const tema = normalizarIconoPatron(p.icono)
      const color = normalizarColorCarpeta(p.colorCarpeta)
      const key = `${tema}::${color}`
      const cur = map.get(key)
      if (cur) cur.items.push(p)
      else map.set(key, { tema, color, items: [p] })
    }
    return [...map.values()].sort((a, b) =>
      carpetaLabel(a.tema, a.color).localeCompare(
        carpetaLabel(b.tema, b.color),
        'es',
      ),
    )
  }, [filtered])

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
    setPendientes([])
    setDragging(false)
  }

  function openNew() {
    setEditId(null)
    setForm(emptyForm)
    setPendientes([])
    setShowForm(true)
  }

  function startEdit(p: Patron) {
    setEditId(p.id)
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion,
      dificultad: p.dificultad,
      tiempoEstimado: p.tiempoEstimado,
      categoria: p.categoria ?? 'Amigurumi',
      icono: normalizarIconoPatron(p.icono),
      colorCarpeta: normalizarColorCarpeta(p.colorCarpeta),
    })
    setPendientes([])
    setShowForm(true)
  }

  function openCarpeta(p: Patron) {
    setCarpetaId(p.id)
    setCarpetaForm({
      categoria: p.categoria ?? 'Amigurumi',
      icono: normalizarIconoPatron(p.icono),
      colorCarpeta: normalizarColorCarpeta(p.colorCarpeta),
    })
  }

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
    if (!form.nombre.trim() || subiendo) return
    setSubiendo(true)
    try {
      const base = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || 'Sin notas todavía',
        dificultad: form.dificultad,
        tiempoEstimado: form.tiempoEstimado.trim() || 'Sin estimar',
        categoria: form.categoria,
        icono: form.icono,
        colorCarpeta: form.colorCarpeta,
      }
      if (editId) {
        await updatePatron(editId, base)
        for (const file of pendientes) {
          await uploadArchivoPatron(editId, file)
        }
      } else {
        const parteId = uid('parte')
        const nuevo: Omit<Patron, 'id' | 'archivos' | 'archivoActivoId'> = {
          ...base,
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
      }
      closeForm()
    } finally {
      setSubiendo(false)
    }
  }

  async function saveCarpeta(e: FormEvent) {
    e.preventDefault()
    if (!carpetaId || subiendo) return
    setSubiendo(true)
    try {
      await updatePatron(carpetaId, {
        categoria: carpetaForm.categoria,
        icono: carpetaForm.icono,
        colorCarpeta: carpetaForm.colorCarpeta,
      })
      setCarpetaId(null)
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
        <button type="button" className="btn btn-primary" onClick={openNew}>
          Anotar en la mesa
        </button>
      </header>

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
          <option value="todas">Todas las dificultades</option>
          <option value="facil">Fácil</option>
          <option value="media">Media</option>
          <option value="dificil">Difícil</option>
        </select>
        <select
          className={styles.filter}
          value={cat}
          onChange={(e) =>
            setCat(e.target.value as 'todas' | CategoriaPatron)
          }
          aria-label="Filtrar por categoría"
        >
          <option value="todas">Todas las categorías</option>
          {CATEGORIAS_PATRON.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className={styles.sort}>
          <span>Orden</span>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            aria-label="Ordenar patrones"
          >
            <option value="carpeta">Carpeta</option>
            <option value="nombre">Nombre</option>
            <option value="categoria">Categoría</option>
            <option value="dificultad">Dificultad</option>
          </select>
        </label>
      </div>

      <Modal
        open={showForm}
        title={editId ? 'Editar patrón' : 'Nuevo patrón'}
        size="lg"
        showActions={false}
        onCancel={() => {
          if (!subiendo) closeForm()
        }}
      >
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          <div className={styles.formGrid}>
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
              <p className={styles.dropText}>Arrastra aquí el patrón o</p>
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
                              (x) =>
                                `${x.name}-${x.size}` !== `${f.name}-${f.size}`,
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
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                  placeholder="Ej. Osito beige"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="desc">Descripción</label>
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
              <div className={styles.field}>
                <label htmlFor="categoria">Categoría</label>
                <select
                  id="categoria"
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      categoria: e.target.value as CategoriaPatron,
                    })
                  }
                  required
                >
                  {CATEGORIAS_PATRON.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <TemaColorPicker
                icono={form.icono}
                color={form.colorCarpeta}
                onIcono={(icono) => setForm({ ...form, icono })}
                onColor={(colorCarpeta) => setForm({ ...form, colorCarpeta })}
              />
            </section>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={subiendo}
              onClick={closeForm}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-sage" disabled={subiendo}>
              {subiendo
                ? 'Guardando…'
                : editId
                  ? 'Guardar cambios'
                  : 'Guardar en la estantería'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(carpetaId)}
        title="Editar carpeta"
        showActions={false}
        onCancel={() => {
          if (!subiendo) setCarpetaId(null)
        }}
      >
        <form className={styles.carpetaForm} onSubmit={(e) => void saveCarpeta(e)}>
          <p className={styles.carpetaLead}>
            Carpeta de <strong>{aCarpeta?.nombre ?? 'este patrón'}</strong>
          </p>
          <div className={styles.field}>
            <label htmlFor="carpeta-cat">Categoría</label>
            <select
              id="carpeta-cat"
              value={carpetaForm.categoria}
              onChange={(e) =>
                setCarpetaForm({
                  ...carpetaForm,
                  categoria: e.target.value as CategoriaPatron,
                })
              }
            >
              {CATEGORIAS_PATRON.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <TemaColorPicker
            icono={carpetaForm.icono}
            color={carpetaForm.colorCarpeta}
            onIcono={(icono) => setCarpetaForm({ ...carpetaForm, icono })}
            onColor={(colorCarpeta) =>
              setCarpetaForm({ ...carpetaForm, colorCarpeta })
            }
          />
          <div className={styles.formActions}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={subiendo}
              onClick={() => setCarpetaId(null)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-sage" disabled={subiendo}>
              {subiendo ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(borrarId)}
        title="Eliminar patrón"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        busy={subiendo}
        onCancel={() => {
          if (!subiendo) setBorrarId(null)
        }}
        onConfirm={() => {
          if (!borrarId) return
          void (async () => {
            setSubiendo(true)
            try {
              await deletePatron(borrarId)
              setBorrarId(null)
            } finally {
              setSubiendo(false)
            }
          })()
        }}
      >
        <p>
          Se eliminará permanentemente{' '}
          <strong>{aBorrar?.nombre ?? 'este patrón'}</strong>.
        </p>
      </Modal>

      {filtered.length === 0 ? (
        <p className={styles.emptyShelf}>
          {patrones.length === 0
            ? 'La estantería está vacía. Anotá el primer patrón.'
            : 'Ningún patrón coincide con los filtros.'}
        </p>
      ) : (
        <div className={styles.carpetas}>
          {carpetas.map(({ tema, color, items }) => {
            const hex =
              COLORES_CARPETA.find((c) => c.id === color)?.hex ?? '#c45f48'
            return (
              <section
                key={`${tema}::${color}`}
                className={styles.carpetaGroup}
              >
                <header
                  className={styles.carpetaHead}
                  style={{ background: hex }}
                >
                  <span className={styles.carpetaIcon}>
                    <PatronTemaIcon id={tema} size={26} />
                  </span>
                  <div className={styles.carpetaMeta}>
                    <h2>{carpetaLabel(tema, color)}</h2>
                    <p>
                      {items.length}{' '}
                      {items.length === 1 ? 'patrón' : 'patrones'}
                    </p>
                  </div>
                </header>

                <ul className={styles.carpetaBody}>
                  {items.map((p) => {
                    const preview = pickPreview(p.archivos)
                    return (
                      <li key={p.id} className={styles.patronCard}>
                        <Link
                          to={`/patrones/${p.id}`}
                          className={styles.patronThumb}
                        >
                          {preview ? (
                            <ArchivoPreview archivo={preview} alt={p.nombre} />
                          ) : (
                            <span
                              className={styles.patronFallback}
                              style={{ background: hex }}
                            >
                              <PatronTemaIcon id={tema} size={32} />
                            </span>
                          )}
                        </Link>
                        <div className={styles.patronInfo}>
                          <div className={styles.patronTop}>
                            <Link
                              to={`/patrones/${p.id}`}
                              className={styles.patronTitle}
                            >
                              {p.nombre}
                            </Link>
                            <span className={`badge badge-${p.dificultad}`}>
                              {labels[p.dificultad]}
                            </span>
                          </div>
                          <p className={styles.patronDesc}>{p.descripcion}</p>
                          <p className={styles.patronMeta}>
                            {p.categoria ?? 'Otro'} · {p.partes.length} partes
                            · {p.tiempoEstimado}
                          </p>
                          <div className={styles.patronActions}>
                            <Link
                              to={`/patrones/${p.id}`}
                              className="btn btn-secondary"
                            >
                              Abrir
                            </Link>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => openCarpeta(p)}
                            >
                              Carpeta
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => startEdit(p)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => setBorrarId(p.id)}
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
