import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react'
import { IconTrash, IconYarn } from '../components/Icons'
import { Modal } from '../components/Modal'
import { useAppData } from '../context/AppDataContext'
import { api } from '../lib/api'
import type { Material, TipoMaterial } from '../types'
import styles from './Materiales.module.css'

const tipoLabels: Record<TipoMaterial, string> = {
  lana: 'Lana',
  aguja: 'Aguja',
  relleno: 'Relleno',
  otro: 'Otro',
}

const empty = {
  nombre: '',
  tipo: 'lana' as TipoMaterial,
  color: '#D4B896',
  cantidad: 50,
  unidad: 'g',
  minimo: 20,
}

type FiltroTipo = 'todos' | TipoMaterial | 'bajos'
type Orden = 'nombre' | 'stock' | 'tipo' | 'estado'

function stockEstado(m: Material): 'ok' | 'bajo' | 'agotado' {
  if (m.cantidad <= 0) return 'agotado'
  if (m.minimo != null && m.cantidad <= m.minimo) return 'bajo'
  return 'ok'
}

const estadoLabel = {
  ok: 'En stock',
  bajo: 'Stock bajo',
  agotado: 'Agotado',
} as const

export function Materiales() {
  const {
    materiales,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    uploadMaterialImagen,
    deleteMaterialImagen,
  } = useAppData()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [fotoPendiente, setFotoPendiente] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroTipo>('todos')
  const [orden, setOrden] = useState<Orden>('nombre')
  const [q, setQ] = useState('')
  const [borrarId, setBorrarId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const bajos = materiales.filter((m) => stockEstado(m) !== 'ok')
  const agotados = materiales.filter((m) => stockEstado(m) === 'agotado')
  const tiposUsados = new Set(materiales.map((m) => m.tipo)).size
  const aBorrar = borrarId
    ? materiales.find((m) => m.id === borrarId)
    : undefined

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    const list = materiales.filter((m) => {
      const matchQ =
        !query ||
        m.nombre.toLowerCase().includes(query) ||
        tipoLabels[m.tipo].toLowerCase().includes(query) ||
        m.unidad.toLowerCase().includes(query)
      if (!matchQ) return false
      if (filtro === 'todos') return true
      if (filtro === 'bajos') return stockEstado(m) !== 'ok'
      return m.tipo === filtro
    })

    const rank = { agotado: 0, bajo: 1, ok: 2 }
    return [...list].sort((a, b) => {
      if (orden === 'stock') return a.cantidad - b.cantidad
      if (orden === 'tipo')
        return tipoLabels[a.tipo].localeCompare(tipoLabels[b.tipo], 'es')
      if (orden === 'estado')
        return rank[stockEstado(a)] - rank[stockEstado(b)]
      return a.nombre.localeCompare(b.nombre, 'es')
    })
  }, [materiales, filtro, q, orden])

  function clearFotoLocal() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoPendiente(null)
    setFotoPreview(null)
  }

  function pickFoto(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 12 * 1024 * 1024) return
    clearFotoLocal()
    setFotoPendiente(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    pickFoto(e.dataTransfer.files?.[0])
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim() || busy) return
    setBusy(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        color: form.color,
        cantidad: Number(form.cantidad) || 0,
        unidad: form.unidad.trim() || 'u',
        minimo: Number(form.minimo) || 0,
      }
      let id = editId
      if (editId) {
        await updateMaterial(editId, payload)
      } else {
        const creado = await addMaterial(payload)
        id = creado.id
      }
      if (id && fotoPendiente) {
        await uploadMaterialImagen(id, fotoPendiente)
      }
      clearFotoLocal()
      setForm(empty)
      setEditId(null)
      setShowForm(false)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(id: string) {
    const m = materiales.find((x) => x.id === id)
    if (!m) return
    clearFotoLocal()
    setForm({
      nombre: m.nombre,
      tipo: m.tipo,
      color: m.color,
      cantidad: m.cantidad,
      unidad: m.unidad,
      minimo: m.minimo ?? 0,
    })
    setEditId(id)
    setShowForm(true)
  }

  function openNew() {
    clearFotoLocal()
    setEditId(null)
    setForm(empty)
    setShowForm((v) => !v)
  }

  async function onCardFoto(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      await uploadMaterialImagen(id, file)
    } finally {
      setBusy(false)
    }
  }

  const editando = editId
    ? materiales.find((m) => m.id === editId)
    : undefined
  const formPreview =
    fotoPreview ??
    (editando?.imagen
      ? api.materialImagenUrl(editando.id, editando.imagen)
      : null)

  return (
    <div className={`page-enter ${styles.page}`}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>Materiales</p>
          <h1>Inventario</h1>
          <p className={styles.lead}>
            Control de stock de lanas, agujas, relleno y accesorios. Umbral
            mínimo y alertas cuando hay que reponer.
          </p>
        </div>
        <button
          type="button"
          className={`btn btn-primary btn-lg ${styles.cta}`}
          onClick={openNew}
        >
          {showForm && !editId ? 'Cerrar formulario' : 'Agregar ítem'}
        </button>

        <div className={styles.stats} aria-label="Indicadores">
          <div className={styles.stat}>
            <strong>{materiales.length}</strong>
            <span>Ítems</span>
          </div>
          <div
            className={`${styles.stat} ${bajos.length ? styles.statWarn : ''}`}
          >
            <strong>{bajos.length}</strong>
            <span>Requieren reposición</span>
          </div>
          <div className={styles.stat}>
            <strong>{agotados.length}</strong>
            <span>Agotados</span>
          </div>
          <div className={styles.stat}>
            <strong>{tiposUsados}</strong>
            <span>Categorías</span>
          </div>
        </div>
      </header>

      {bajos.length > 0 && filtro !== 'bajos' ? (
        <button
          type="button"
          className={styles.alert}
          onClick={() => setFiltro('bajos')}
        >
          <span className={styles.alertDot} aria-hidden />
          {bajos.length === 1
            ? '1 ítem por debajo del mínimo o agotado'
            : `${bajos.length} ítems por debajo del mínimo o agotados`}
          <span className={styles.alertLink}>Filtrar</span>
        </button>
      ) : null}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por nombre, tipo o unidad…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar en el inventario"
        />
        <div className={styles.toolbarRow}>
          <div className={styles.chips} role="tablist" aria-label="Categoría">
            {(
              [
                ['todos', 'Todos'],
                ['bajos', 'A reponer'],
                ['lana', 'Lana'],
                ['aguja', 'Agujas'],
                ['relleno', 'Relleno'],
                ['otro', 'Otros'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filtro === id}
                className={filtro === id ? styles.chipOn : styles.chip}
                onClick={() => setFiltro(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className={styles.sort}>
            <span>Orden</span>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              aria-label="Ordenar inventario"
            >
              <option value="nombre">Nombre</option>
              <option value="stock">Stock</option>
              <option value="tipo">Categoría</option>
              <option value="estado">Estado</option>
            </select>
          </label>
        </div>
      </div>

      <Modal
        open={Boolean(borrarId)}
        title="Eliminar del inventario"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
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
              await deleteMaterial(borrarId)
              setBorrarId(null)
            } finally {
              setBusy(false)
            }
          })()
        }}
      >
        <p>
          Se eliminará permanentemente{' '}
          <strong>{aBorrar?.nombre ?? 'este ítem'}</strong>.
        </p>
      </Modal>

      {showForm ? (
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          <div className={styles.formHead}>
            <h2>{editId ? 'Editar ítem' : 'Nuevo ítem'}</h2>
            <p>
              Completá los datos de stock. La foto es opcional y sirve para
              identificar el material.
            </p>
          </div>

          <div
            className={`${styles.drop} ${dragging ? styles.dropOn : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {formPreview ? (
              <img src={formPreview} alt="" className={styles.dropPreview} />
            ) : (
              <span className={styles.dropIcon}>
                <IconYarn width={28} height={28} />
              </span>
            )}
            <div className={styles.dropText}>
              <strong>Imagen del material</strong>
              <span>Arrastrá un archivo o seleccioná desde el dispositivo</span>
            </div>
            <div className={styles.dropActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
              >
                Subir imagen
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => pickFoto(e.target.files?.[0])}
              />
              {editando?.imagen && !fotoPendiente ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void deleteMaterialImagen(editando.id)}
                >
                  Quitar imagen
                </button>
              ) : null}
              {fotoPendiente ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={clearFotoLocal}
                >
                  Descartar
                </button>
              ) : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="mat-nombre">Nombre del ítem</label>
            <input
              id="mat-nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
              placeholder="Ej. Lana beige merino, aguja 2.5 mm…"
            />
          </div>
          <div className={styles.row}>
            <div className="field">
              <label htmlFor="mat-tipo">Categoría</label>
              <select
                id="mat-tipo"
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as TipoMaterial })
                }
              >
                {(Object.keys(tipoLabels) as TipoMaterial[]).map((t) => (
                  <option key={t} value={t}>
                    {tipoLabels[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mat-color">Color de referencia</label>
              <div className={styles.colorRow}>
                <input
                  id="mat-color"
                  type="color"
                  value={form.color}
                  onChange={(e) =>
                    setForm({ ...form, color: e.target.value })
                  }
                />
                <span className={styles.colorHex}>{form.color}</span>
              </div>
            </div>
          </div>
          <div className={styles.row3}>
            <div className="field">
              <label htmlFor="mat-cant">Cantidad actual</label>
              <input
                id="mat-cant"
                type="number"
                min={0}
                value={form.cantidad}
                onChange={(e) =>
                  setForm({ ...form, cantidad: Number(e.target.value) })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="mat-unidad">Unidad</label>
              <input
                id="mat-unidad"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                placeholder="g, u, ovillos…"
              />
            </div>
            <div className="field">
              <label htmlFor="mat-min">Stock mínimo</label>
              <input
                id="mat-min"
                type="number"
                min={0}
                value={form.minimo}
                onChange={(e) =>
                  setForm({ ...form, minimo: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className="btn btn-sage" disabled={busy}>
              {busy ? 'Guardando…' : editId ? 'Guardar cambios' : 'Registrar ítem'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowForm(false)
                setEditId(null)
                setForm(empty)
                clearFotoLocal()
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {materiales.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <IconYarn width={36} height={36} />
          </span>
          <h2>Inventario vacío</h2>
          <p>
            Registrá el primer material para comenzar el control de stock.
          </p>
          <button type="button" className="btn btn-primary" onClick={openNew}>
            Agregar ítem
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyFilter}>
          <p>No hay ítems que coincidan con los filtros actuales.</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setQ('')
              setFiltro('todos')
            }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <>
          <p className={styles.resultCount}>
            {filtered.length}{' '}
            {filtered.length === 1 ? 'ítem' : 'ítems'}
            {filtro !== 'todos' || q ? ' encontrados' : ' en inventario'}
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Ítem</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Mínimo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const estado = stockEstado(m)
                  const maxRef = Math.max(m.minimo ?? 1, m.cantidad, 1)
                  const pct = Math.min(
                    100,
                    Math.round((m.cantidad / maxRef) * 100),
                  )
                  return (
                    <tr
                      key={m.id}
                      className={
                        estado !== 'ok' ? styles.rowAlert : undefined
                      }
                    >
                      <td>
                        <div className={styles.itemCell}>
                          {m.imagen ? (
                            <img
                              src={api.materialImagenUrl(m.id, m.imagen)}
                              alt=""
                              className={styles.thumb}
                            />
                          ) : (
                            <span
                              className={styles.thumbSwatch}
                              style={{ background: m.color }}
                              aria-hidden
                            />
                          )}
                          <div>
                            <strong className={styles.itemName}>
                              {m.nombre}
                            </strong>
                            <label className={styles.fotoInline}>
                              Cambiar foto
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={busy}
                                onChange={(e) => void onCardFoto(m.id, e)}
                              />
                            </label>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.cat}>{tipoLabels[m.tipo]}</span>
                      </td>
                      <td>
                        <div className={styles.stockCell}>
                          <strong>
                            {m.cantidad} {m.unidad}
                          </strong>
                          <div
                            className={styles.bar}
                            role="meter"
                            aria-valuenow={m.cantidad}
                            aria-valuemin={0}
                            aria-valuemax={maxRef}
                          >
                            <span
                              className={
                                estado === 'ok'
                                  ? styles.barFill
                                  : styles.barLow
                              }
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={styles.minCell}>
                        {m.minimo != null ? `${m.minimo} ${m.unidad}` : '—'}
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            estado === 'ok'
                              ? styles.badgeOk
                              : estado === 'bajo'
                                ? styles.badgeLow
                                : styles.badgeOut
                          }`}
                        >
                          {estadoLabel[estado]}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() =>
                              void updateMaterial(m.id, {
                                cantidad: Math.max(0, m.cantidad - 10),
                              })
                            }
                            aria-label={`Restar 10 a ${m.nombre}`}
                          >
                            −10
                          </button>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() =>
                              void updateMaterial(m.id, {
                                cantidad: m.cantidad + 10,
                              })
                            }
                            aria-label={`Sumar 10 a ${m.nombre}`}
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            className={styles.textBtn}
                            onClick={() => startEdit(m.id)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={styles.iconDanger}
                            onClick={() => setBorrarId(m.id)}
                            aria-label={`Eliminar ${m.nombre}`}
                            title="Eliminar"
                          >
                            <IconTrash width={16} height={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
